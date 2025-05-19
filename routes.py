from flask import Blueprint, jsonify, request, send_from_directory, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import uuid

from models import db, User, Prediction, Vote, Category, Image, Transaction, Comment

# Create blueprint for API routes
api = Blueprint('api', __name__, url_prefix='/api')

# Helper functions
def get_user_from_wallet(wallet_address):
    user = User.query.filter_by(wallet_address=wallet_address).first()
    if not user:
        # Create new user if wallet not found
        username = f"user_{uuid.uuid4().hex[:8]}"
        user = User(
            username=username,
            wallet_address=wallet_address
        )
        db.session.add(user)
        db.session.commit()
    return user

# Authentication routes
@api.route('/auth/register', methods=['POST'])
def register():
    data = request.json
    
    # Check if user already exists
    existing_user = User.query.filter_by(username=data.get('username')).first()
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400
        
    # Create new user
    user = User(
        username=data.get('username'),
        password_hash=generate_password_hash(data.get('password')),
        email=data.get('email'),
        wallet_address=data.get('wallet_address', None)
    )
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({"message": "User registered successfully", "user": user.to_dict()}), 201

@api.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    
    # For username/password login
    if 'username' in data and 'password' in data:
        user = User.query.filter_by(username=data.get('username')).first()
        
        if not user or not check_password_hash(user.password_hash, data.get('password')):
            return jsonify({"error": "Invalid credentials"}), 401
            
    # For wallet login
    elif 'wallet_address' in data:
        user = get_user_from_wallet(data.get('wallet_address'))
    else:
        return jsonify({"error": "Invalid login information"}), 400
    
    return jsonify({"message": "Login successful", "user": user.to_dict()}), 200

# User routes
@api.route('/user/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify(user.to_dict(include_stats=True)), 200

@api.route('/user/profile', methods=['PUT'])
@jwt_required()
def update_user_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    data = request.json
    for key, value in data.items():
        if key != 'id' and hasattr(user, key):
            setattr(user, key, value)
            
    db.session.commit()
    return jsonify(user.to_dict()), 200

# Prediction routes
@api.route('/predictions', methods=['GET'])
def get_predictions():
    category = request.args.get('category', 'all')
    query = Prediction.query
    
    if category != 'all':
        query = query.join(Prediction.categories).filter(Category.name == category)
    
    predictions = query.order_by(Prediction.created_at.desc()).all()
    return jsonify([p.to_dict() for p in predictions]), 200

@api.route('/predictions/<int:prediction_id>', methods=['GET'])
def get_prediction(prediction_id):
    prediction = Prediction.query.get(prediction_id)
    
    if not prediction:
        return jsonify({"error": "Prediction not found"}), 404
        
    return jsonify(prediction.to_dict(include_votes=True)), 200

@api.route('/predictions', methods=['POST'])
@jwt_required()
def create_prediction():
    user_id = get_jwt_identity()
    data = request.json
    
    # Create new prediction
    prediction = Prediction(
        title=data.get('title'),
        description=data.get('description'),
        end_date=datetime.fromisoformat(data.get('end_date')),
        created_by=user_id
    )
    
    # Add categories
    category_names = data.get('categories', [])
    for cat_name in category_names:
        category = Category.query.filter_by(name=cat_name).first()
        if category:
            prediction.categories.append(category)
    
    db.session.add(prediction)
    db.session.commit()
    
    return jsonify(prediction.to_dict()), 201

@api.route('/predictions/<int:prediction_id>/vote', methods=['POST'])
@jwt_required()
def vote_on_prediction(prediction_id):
    user_id = get_jwt_identity()
    data = request.json
    
    prediction = Prediction.query.get(prediction_id)
    if not prediction:
        return jsonify({"error": "Prediction not found"}), 404
        
    # Check if prediction is still active
    if datetime.now() > prediction.end_date:
        return jsonify({"error": "Prediction has ended"}), 400
        
    # Check if user already voted
    existing_vote = Vote.query.filter_by(
        user_id=user_id, 
        prediction_id=prediction_id
    ).first()
    
    if existing_vote:
        # Update existing vote
        existing_vote.choice = data.get('choice')
        existing_vote.amount = data.get('amount')
        db.session.commit()
        return jsonify(existing_vote.to_dict()), 200
    
    # Create new vote
    vote = Vote(
        prediction_id=prediction_id,
        user_id=user_id,
        choice=data.get('choice'),
        amount=data.get('amount')
    )
    
    db.session.add(vote)
    
    # Record transaction
    transaction = Transaction(
        user_id=user_id,
        amount=data.get('amount'),
        transaction_type='VOTE',
        description=f"Vote on prediction {prediction.title}"
    )
    db.session.add(transaction)
    
    db.session.commit()
    
    return jsonify(vote.to_dict()), 201

@api.route('/predictions/<int:prediction_id>/comments', methods=['GET'])
def get_prediction_comments(prediction_id):
    prediction = Prediction.query.get(prediction_id)
    
    if not prediction:
        return jsonify({"error": "Prediction not found"}), 404
        
    comments = Comment.query.filter_by(prediction_id=prediction_id).order_by(Comment.created_at.desc()).all()
    return jsonify([c.to_dict() for c in comments]), 200

@api.route('/predictions/<int:prediction_id>/comments', methods=['POST'])
@jwt_required()
def add_prediction_comment(prediction_id):
    user_id = get_jwt_identity()
    data = request.json
    
    prediction = Prediction.query.get(prediction_id)
    if not prediction:
        return jsonify({"error": "Prediction not found"}), 404
        
    comment = Comment(
        prediction_id=prediction_id,
        user_id=user_id,
        content=data.get('content')
    )
    
    db.session.add(comment)
    db.session.commit()
    
    return jsonify(comment.to_dict()), 201

# Image upload route
@api.route('/upload', methods=['POST'])
@jwt_required()
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file found"}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No image file selected"}), 400
        
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{filename}"
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(file_path)
    
    prediction_id = request.form.get('prediction_id')
    
    # Save image record
    image = Image(
        filename=unique_filename,
        original_filename=filename,
        prediction_id=prediction_id if prediction_id else None
    )
    
    db.session.add(image)
    db.session.commit()
    
    return jsonify({
        "id": image.id,
        "url": f"/api/uploads/{unique_filename}"
    }), 201

@api.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)

# Categories
@api.route('/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return jsonify([c.to_dict() for c in categories]), 200
