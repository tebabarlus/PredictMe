from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

# Association table for many-to-many relationship between predictions and categories
prediction_categories = db.Table('prediction_categories',
    db.Column('prediction_id', db.Integer, db.ForeignKey('prediction.id'), primary_key=True),
    db.Column('category_id', db.Integer, db.ForeignKey('category.id'), primary_key=True)
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(256), nullable=True)
    wallet_address = db.Column(db.String(42), unique=True, nullable=True)
    profile_image = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.String(500), nullable=True)
    token_balance = db.Column(db.Float, default=100.0)  # Default starter balance
    referral_code = db.Column(db.String(10), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    predictions = db.relationship('Prediction', backref='creator', lazy=True,
                                 foreign_keys='Prediction.created_by')
    votes = db.relationship('Vote', backref='user', lazy=True)
    transactions = db.relationship('Transaction', backref='user', lazy=True)
    comments = db.relationship('Comment', backref='user', lazy=True)
    
    def to_dict(self, include_stats=False):
        result = {
            'id': self.id,
            'username': self.username,
            'profile_image': self.profile_image,
            'wallet_address': self.wallet_address,
            'token_balance': self.token_balance,
            'created_at': self.created_at.isoformat()
        }
        
        if include_stats:
            # Calculate user stats
            result['stats'] = {
                'total_predictions': len(self.predictions),
                'total_votes': len(self.votes),
                'completed_predictions': len([p for p in self.predictions if p.status == 'COMPLETED']),
                'wins': len([v for v in self.votes if v.prediction and v.prediction.result == v.choice]),
                'active_predictions': len([p for p in self.predictions if p.status == 'ACTIVE']),
                'ftn_won': sum([t.amount for t in self.transactions if t.transaction_type == 'WIN'])
            }
            
        return result

class Prediction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    end_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='ACTIVE')  # ACTIVE, COMPLETED, CANCELLED
    result = db.Column(db.String(20), nullable=True)  # Can be YES, NO, or null if not determined
    
    # Relationships
    categories = db.relationship('Category', secondary=prediction_categories, backref=db.backref('predictions', lazy='dynamic'))
    votes = db.relationship('Vote', backref='prediction', lazy=True)
    images = db.relationship('Image', backref='prediction', lazy=True)
    comments = db.relationship('Comment', backref='prediction', lazy=True)
    
    def to_dict(self, include_votes=False):
        result = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'end_date': self.end_date.isoformat(),
            'status': self.status,
            'result': self.result,
            'categories': [c.name for c in self.categories],
            'images': [img.get_url() for img in self.images]
        }
        
        # Calculate vote statistics
        yes_votes = [v for v in self.votes if v.choice == 'YES']
        no_votes = [v for v in self.votes if v.choice == 'NO']
        
        total_votes = len(self.votes)
        yes_percentage = round((len(yes_votes) / total_votes) * 100) if total_votes > 0 else 0
        no_percentage = round((len(no_votes) / total_votes) * 100) if total_votes > 0 else 0
        
        result['vote_stats'] = {
            'total_votes': total_votes,
            'yes_percentage': yes_percentage,
            'no_percentage': no_percentage,
            'total_amount': sum([v.amount for v in self.votes])
        }
        
        if include_votes:
            result['votes'] = [v.to_dict() for v in self.votes]
            
        return result

class Vote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey('prediction.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    choice = db.Column(db.String(10), nullable=False)  # YES or NO
    amount = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'prediction_id': self.prediction_id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'choice': self.choice,
            'amount': self.amount,
            'created_at': self.created_at.isoformat()
        }

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    prediction_id = db.Column(db.Integer, db.ForeignKey('prediction.id'), nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def get_url(self):
        return f"/api/uploads/{self.filename}"
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'prediction_id': self.prediction_id,
            'url': self.get_url(),
            'uploaded_at': self.uploaded_at.isoformat()
        }

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False)  # VOTE, WIN, DEPOSIT, WITHDRAW
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': self.amount,
            'transaction_type': self.transaction_type,
            'description': self.description,
            'created_at': self.created_at.isoformat()
        }

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey('prediction.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'prediction_id': self.prediction_id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'content': self.content,
            'created_at': self.created_at.isoformat()
        }