from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Account, Transaction
from sqlalchemy import or_

transactions_bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')


def _parse_date(value: str) -> datetime | None:
    for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S'):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


@transactions_bp.route('/', methods=['GET'])
@jwt_required()
def get_transactions():
    user_id = int(get_jwt_identity())

    # Gather all account ids belonging to the user
    user_accounts = Account.query.filter_by(user_id=user_id).all()
    account_ids = [a.id for a in user_accounts]

    if not account_ids:
        return jsonify({'transactions': []}), 200

    account_id_filter = request.args.get('account_id', type=int)
    tx_type = request.args.get('type')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    limit = request.args.get('limit', default=50, type=int)

    query = Transaction.query.filter(
        or_(
            Transaction.from_account_id.in_(account_ids),
            Transaction.to_account_id.in_(account_ids),
        )
    )

    if account_id_filter:
        if account_id_filter not in account_ids:
            return jsonify({'error': 'Account not found'}), 404
        query = query.filter(
            or_(
                Transaction.from_account_id == account_id_filter,
                Transaction.to_account_id == account_id_filter,
            )
        )

    if tx_type in ('deposit', 'withdrawal', 'transfer'):
        query = query.filter(Transaction.transaction_type == tx_type)

    if start_date_str:
        start_dt = _parse_date(start_date_str)
        if start_dt:
            query = query.filter(Transaction.timestamp >= start_dt)

    if end_date_str:
        end_dt = _parse_date(end_date_str)
        if end_dt:
            query = query.filter(Transaction.timestamp <= end_dt)

    transactions = (
        query.order_by(Transaction.timestamp.desc()).limit(min(limit, 200)).all()
    )
    return jsonify({'transactions': [t.to_dict() for t in transactions]}), 200


@transactions_bp.route('/deposit', methods=['POST'])
@jwt_required()
def deposit():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    account_id = data.get('account_id')
    amount = data.get('amount')
    description = (data.get('description') or 'Deposit').strip()

    if not account_id:
        return jsonify({'error': 'account_id is required'}), 400
    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400

    account = Account.query.filter_by(id=account_id, user_id=user_id, is_active=True).with_for_update().first()
    if not account:
        return jsonify({'error': 'Account not found'}), 404

    account.balance = round(float(account.balance) + amount, 2)
    tx = Transaction(
        transaction_type='deposit',
        amount=round(amount, 2),
        description=description,
        to_account_id=account.id,
        balance_after=account.balance,
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify({'transaction': tx.to_dict(), 'account': account.to_dict()}), 201


@transactions_bp.route('/withdraw', methods=['POST'])
@jwt_required()
def withdraw():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    account_id = data.get('account_id')
    amount = data.get('amount')
    description = (data.get('description') or 'Withdrawal').strip()

    if not account_id:
        return jsonify({'error': 'account_id is required'}), 400
    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400

    account = Account.query.filter_by(id=account_id, user_id=user_id, is_active=True).with_for_update().first()
    if not account:
        return jsonify({'error': 'Account not found'}), 404

    if float(account.balance) < amount:
        return jsonify({'error': 'Insufficient funds'}), 400

    account.balance = round(float(account.balance) - amount, 2)
    tx = Transaction(
        transaction_type='withdrawal',
        amount=round(amount, 2),
        description=description,
        from_account_id=account.id,
        balance_after=account.balance,
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify({'transaction': tx.to_dict(), 'account': account.to_dict()}), 201


@transactions_bp.route('/transfer', methods=['POST'])
@jwt_required()
def transfer():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    from_account_id = data.get('from_account_id')
    to_account_id = data.get('to_account_id')
    amount = data.get('amount')
    description = (data.get('description') or 'Transfer').strip()

    if not from_account_id or not to_account_id:
        return jsonify({'error': 'from_account_id and to_account_id are required'}), 400
    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400
    if from_account_id == to_account_id:
        return jsonify({'error': 'Cannot transfer to the same account'}), 400

    # Lock both accounts in consistent order (by id) to prevent deadlocks
    lower_id = min(from_account_id, to_account_id)
    upper_id = max(from_account_id, to_account_id)
    locked = {
        a.id: a
        for a in Account.query.filter(
            Account.id.in_([lower_id, upper_id]), Account.is_active.is_(True)
        ).with_for_update().all()
    }
    from_account = locked.get(from_account_id)
    if not from_account or from_account.user_id != user_id:
        return jsonify({'error': 'Source account not found'}), 404
    to_account = locked.get(to_account_id)
    if not to_account:
        return jsonify({'error': 'Destination account not found'}), 404

    if float(from_account.balance) < amount:
        return jsonify({'error': 'Insufficient funds'}), 400

    from_account.balance = round(float(from_account.balance) - amount, 2)
    to_account.balance = round(float(to_account.balance) + amount, 2)

    tx = Transaction(
        transaction_type='transfer',
        amount=round(amount, 2),
        description=description,
        from_account_id=from_account.id,
        to_account_id=to_account.id,
        balance_after=from_account.balance,
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify({'transaction': tx.to_dict(), 'from_account': from_account.to_dict()}), 201
