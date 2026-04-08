import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User, Account
import random
import string

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def generate_account_number() -> str:
    digits = ''.join(random.choices(string.digits, k=10))
    return f'ACC{digits}'


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password', '')
    full_name = (data.get('full_name') or '').strip()

    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return jsonify({'error': 'Invalid email format'}), 400
    if not password or len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if not full_name:
        return jsonify({'error': 'Full name is required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(username=username, email=email, full_name=full_name)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # get user.id before commit

    account_number = generate_account_number()
    while Account.query.filter_by(account_number=account_number).first():
        account_number = generate_account_number()

    account = Account(
        account_number=account_number,
        account_type='checking',
        balance=0.0,
        user_id=user.id,
    )
    db.session.add(account)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    return jsonify({'access_token': access_token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    username = (data.get('username') or '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403

    access_token = create_access_token(identity=str(user.id))
    return jsonify({'access_token': access_token, 'user': user.to_dict()}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'message': 'Successfully logged out'}), 200
