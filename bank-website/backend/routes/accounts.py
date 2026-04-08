import secrets
import string
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Account

accounts_bp = Blueprint('accounts', __name__, url_prefix='/api/accounts')


def generate_account_number() -> str:
    digits = ''.join(secrets.choice(string.digits) for _ in range(10))
    return f'ACC{digits}'


@accounts_bp.route('/', methods=['GET'])
@jwt_required()
def list_accounts():
    user_id = int(get_jwt_identity())
    accounts = Account.query.filter_by(user_id=user_id, is_active=True).all()
    return jsonify({'accounts': [a.to_dict() for a in accounts]}), 200


@accounts_bp.route('/', methods=['POST'])
@jwt_required()
def create_account():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    account_type = (data.get('account_type') or '').strip().lower()
    if account_type not in ('checking', 'savings'):
        return jsonify({'error': "account_type must be 'checking' or 'savings'"}), 400

    account_number = generate_account_number()
    while Account.query.filter_by(account_number=account_number).first():
        account_number = generate_account_number()

    account = Account(
        account_number=account_number,
        account_type=account_type,
        balance=0.0,
        user_id=user_id,
    )
    db.session.add(account)
    db.session.commit()
    return jsonify({'account': account.to_dict()}), 201


@accounts_bp.route('/<int:account_id>', methods=['GET'])
@jwt_required()
def get_account(account_id: int):
    user_id = int(get_jwt_identity())
    account = Account.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    return jsonify({'account': account.to_dict()}), 200


@accounts_bp.route('/<int:account_id>', methods=['PUT'])
@jwt_required()
def update_account(account_id: int):
    user_id = int(get_jwt_identity())
    account = Account.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        return jsonify({'error': 'Account not found'}), 404

    data = request.get_json() or {}
    # Only allow updating account_type label (nickname-type update)
    new_type = data.get('account_type')
    if new_type and new_type in ('checking', 'savings'):
        account.account_type = new_type

    db.session.commit()
    return jsonify({'account': account.to_dict()}), 200
