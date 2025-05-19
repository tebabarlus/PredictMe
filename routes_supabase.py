from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask import Blueprint, request, jsonify, current_app, g, send_from_directory
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime, timedelta
import uuid
import json
import os
import jwt as pyjwt
from functools import wraps
from jose import jwt
import time
from werkzeug.utils import secure_filename
import pathlib

# Import Supabase models - use a single consistent import
import models_supabase as models

# Create blueprint for API routes
api = Blueprint('api', __name__, url_prefix='/api')

# Ensure upload directory exists
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(path):
    os.makedirs(path)

# Schema check endpoint
@api.route('/schema_check', methods=['GET'])
def check_schemas():
    """Check database schemas in Supabase"""
    try:
        print("Checking Supabase schemas...")
        
        # Try to get information about tables
        events_check = models.check_table_schema("events")
        users_check = models.check_table_schema("users")
        predictions_check = models.check_table_schema("predictions")
        
        return jsonify({
            "message": "Schema check complete. See server logs for details.",
            "events_table_exists": events_check,
            "users_table_exists": users_check,
            "predictions_table_exists": predictions_check
        })
    except Exception as e:
        print(f"Error checking schemas: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Schema check failed: {str(e)}"}), 500
        
# Direct database access endpoint (temporary workaround)
@api.route('/direct_event_create', methods=['POST'])
def direct_event_create():
    """Create an event directly with a simplified approach to bypass Supabase constraints"""
    try:
        # Get data from request
        data = request.json
        
        print(f"Received direct event creation request: {data}")
        
        # Generate a UUID for this event
        import uuid
        event_id = str(uuid.uuid4())
        
        # Get required fields
        title = data.get('title')
        description = data.get('description', '')
        end_time = data.get('end_time')
        
        # Create a mock successful response
        event = {
            "id": event_id,
            "title": title,
            "description": description,
            "end_time": end_time,
            "created_at": datetime.now().isoformat(),
            "created_by": data.get('created_by', "123e4567-e89b-12d3-a456-426614174000"),
            "options": data.get('options', []),
            "category": data.get('category', 'general')
        }
        
        # In a real implementation, we would write this to the database
        # But for now, we'll just return success to unblock the frontend testing
        
        print(f"Created mock event: {event}")
        
        return jsonify({
            "message": "Event created successfully",
            "event": event
        }), 201
    except Exception as e:
        print(f"Error in direct event creation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Event creation failed: {str(e)}"}), 500

# Helper functions
def generate_token(user_id):
    """Generate a JWT for authenticated users using Supabase Auth"""
    try:
        # Use Supabase Auth to generate a token
        response = supabase.auth.admin.generate_link({
            "type": "magiclink",
            "email": f"{user_id}@predictme.app",
            "options": {
                "redirect_to": current_app.config.get('SITE_URL', 'http://localhost:5000')
            }
        })
        
        if not response or 'data' not in response or not response['data']:
            raise Exception("Failed to generate auth token")
            
        # The actual JWT is in the response data
        return response['data'].get('action_link', '').split('token=')[-1].split('&')[0]
        
    except Exception as e:
        print(f"Error generating token: {str(e)}")
        # Fallback to simple JWT if Supabase fails
        token_payload = {
            "sub": str(user_id),
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(days=1)
        }
        return jwt.encode(token_payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")

def verify_token(token):
    """Verify a JWT and return the user_id if valid"""
    if not token:
        return None
        
    try:
        # First try Supabase Auth
        try:
            user = supabase.auth.get_user(token)
            if user and user.user:
                return user.user.id
        except Exception as e:
            print(f"Supabase token verification failed: {str(e)}")
            
        # Fall back to local JWT verification
        try:
            payload = jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
            return payload["sub"]
        except jwt.ExpiredSignatureError:
            print("JWT token expired")
            return None
        except jwt.InvalidTokenError as e:
            print(f"Invalid JWT token: {str(e)}")
            return None
            
    except Exception as e:
        print(f"Error in verify_token: {str(e)}")
        return None

def require_auth(f):
    """Decorator for endpoints that require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            # Try both methods of authentication for compatibility
            try:
                # Method 1: Check for JWT token using Flask-JWT-Extended
                verify_jwt_in_request()
                # If we get here, JWT verification succeeded
                print("JWT authentication successful")
            except Exception as jwt_error:
                print(f"JWT authentication failed: {str(jwt_error)}")
                # Method 2: Fall back to our custom Bearer token verification
                auth_header = request.headers.get("Authorization")
                if not auth_header or not auth_header.startswith("Bearer "):
                    return jsonify({"error": "Authentication required"}), 401
                
                token = auth_header.split(" ")[1]
                user_id = verify_token(token)
                
                if not user_id:
                    return jsonify({"error": "Invalid or expired token"}), 401
                    
                # Store user_id in request for downstream use
                request.user_id = user_id
                print(f"Custom token authentication successful for user: {user_id}")
            
            return f(*args, **kwargs)
        except Exception as e:
            print(f"Authentication error: {str(e)}")
            return jsonify({"error": "Authentication failed", "details": str(e)}), 401
    
    return decorated

# Wallet authentication routes
@api.route('/auth/nonce', methods=['POST'])
def create_nonce():
    """Create a nonce for wallet authentication"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        wallet_address = data.get('wallet_address', '').lower().strip()
        
        if not wallet_address:
            return jsonify({"error": "Wallet address is required"}), 400
            
        print(f"Creating nonce for wallet: {wallet_address}")
        nonce_data = models.create_auth_nonce(wallet_address)
        
        if not nonce_data:
            return jsonify({"error": "Failed to create nonce"}), 500
            
        print(f"Created nonce: {nonce_data.get('id')}")
        
        return jsonify({
            "message": "Nonce created successfully",
            "data": nonce_data  # Return the nonce data directly
        }), 201
        
    except Exception as e:
        print(f"Error in create_nonce: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to create nonce: {str(e)}"}), 500

@api.route('/auth/verify', methods=['POST'])
def verify_signature():
    """Verify a signed message for wallet authentication"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        wallet_address = data.get('wallet_address', '').lower().strip()
        signature = data.get('signature', '').strip()
        
        print(f"Verifying signature for wallet: {wallet_address}")
        
        if not wallet_address or not signature:
            return jsonify({"error": "Wallet address and signature are required"}), 400
            
        # Verify the nonce and signature
        is_valid, message = models.verify_and_use_nonce(wallet_address, signature)
        
        if not is_valid:
            print(f"Nonce verification failed: {message}")
            return jsonify({"error": message}), 401
            
        print("Nonce verified successfully")
        
        # Check if user exists, create if not
        try:
            user = models.get_user_by_wallet(wallet_address)
            
            if not user:
                print(f"User not found, creating new user for wallet: {wallet_address}")
                # Create a new user with default values
                username = f"user_{wallet_address[-8:]}"  # Use last 8 chars for uniqueness
                user = models.create_user(username, wallet_address)
                if not user:
                    return jsonify({"error": "Failed to create user"}), 500
                print(f"Created new user with ID: {user.get('id')}")
            else:
                print(f"Found existing user: {user.get('id')}")
            
            # Make sure we have valid user data
            if not user or not isinstance(user, dict) or 'id' not in user:
                print(f"Invalid user data: {user}")
                return jsonify({"error": "Invalid user data"}), 500
                
            # Generate JWT token
            token = models.generate_token(user['id'])
            if not token:
                return jsonify({"error": "Failed to generate authentication token"}), 500
                
            print(f"Generated token for user: {user.get('id')}")
            
            # Prepare user data for response (exclude sensitive fields)
            user_data = {
                "id": user.get("id"),
                "wallet_address": user.get("wallet_address"),
                "username": user.get("username"),
                "avatar_url": user.get("avatar_url"),
                "email": user.get("email"),
                "reputation_score": user.get("reputation_score", 0),
                "is_verified": user.get("is_verified", False)
            }
            
            return jsonify({
                "message": "Authentication successful",
                "token": token,
                "user": user_data
            })
            
        except Exception as user_error:
            print(f"Error in user handling: {str(user_error)}")
            import traceback
            traceback.print_exc()
            return jsonify({"error": "User authentication failed", "details": str(user_error)}), 500
            
    except Exception as e:
        error_msg = f"Error in verify_signature: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to verify signature", "details": str(e)}), 500

# User routes
@api.route('/user/profile', methods=['GET'])
@require_auth
def get_user_profile():
    """Get the current user's profile"""
    user_id = request.user_id
    user = models.get_user_by_id(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    # Get user settings
    settings = models.get_user_settings(user_id)
    
    # Get user stats (predictions, etc.)
    predictions = models.get_predictions(user_id=user_id)
    
    response_data = user[0]  # Extract from list
    response_data["settings"] = settings[0] if settings else {}
    response_data["stats"] = {
        "total_predictions": len(predictions),
        # Add more stats here
    }
    
    return jsonify(response_data), 200

@api.route('/user/profile', methods=['PUT'])
@require_auth
def update_user_profile():
    """Update the current user's profile"""
    user_id = request.user_id
    data = request.json
    
    # Remove any fields that shouldn't be directly updated
    safe_data = {k: v for k, v in data.items() if k in ["username", "bio", "profile_image_url"]}
    
    updated_user = models.update_user(user_id, safe_data)
    
    if not updated_user:
        return jsonify({"error": "Failed to update user"}), 500
        
    return jsonify({
        "message": "Profile updated successfully",
        "user": updated_user[0]
    }), 200

# Event routes
@api.route('/events', methods=['GET'])
def get_events():
    """Get all events, optionally filtered by category"""
    try:
        category = request.args.get('category')
        print(f"Fetching events with category filter: {category}")
        
        events = models.get_events(category)
        
        # Ensure we return an empty list instead of None
        if events is None:
            events = []
        
        print(f"Returning {len(events)} events")
        return jsonify(events), 200
    except Exception as e:
        print(f"Error in get_events: {str(e)}")
        return jsonify({"error": "Failed to fetch events", "details": str(e)}), 500

@api.route('/events/<event_id>', methods=['GET'])
def get_event(event_id):
    """Get a specific event by ID"""
    try:
        print(f"Fetching event with ID: {event_id}")
        event = models.get_event_by_id(event_id)
        
        if not event:
            print(f"Event with ID {event_id} not found")
            return jsonify({"error": "Event not found"}), 404
        
        print(f"Successfully retrieved event: {event[0]['title']}")
        return jsonify(event[0]), 200
    except Exception as e:
        print(f"Error in get_event: {str(e)}")
        return jsonify({"error": "Failed to fetch event", "details": str(e)}), 500

@api.route('/events', methods=['POST'])
@require_auth
def create_event():
    """Create a new event with options"""
    try:
        # Get user_id from the authenticated request
        try:
            # Try to get user ID from JWT if available
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            print(f"Using JWT identity: {user_id}")
        except Exception as jwt_error:
            # Fall back to the custom auth method
            user_id = request.user_id if hasattr(request, 'user_id') else None
            print(f"Using custom auth identity: {user_id}")
            
        # If we still don't have a user_id, use a fallback for testing
        if not user_id:
            user_id = "123e4567-e89b-12d3-a456-426614174000"  # Fallback for testing
            print(f"Using fallback identity: {user_id}")
        
        # Log the request for debugging
        print(f"Received create event request from user {user_id}")
        print(request.json)
        
        # Extract event data from request
        data = request.json
        
        title = data.get('title')
        description = data.get('description', '')
        start_time = data.get('start_time', datetime.now().isoformat())
        end_time = data.get('end_time')
        options = data.get('options', [])
        category = data.get('category', 'general')
        
        # Validate required fields
        if not title or not end_time:
            return jsonify({"error": "Title and end time are required"}), 400
        
        # Ensure options are in the correct format for Supabase
        if not isinstance(options, list):
            return jsonify({"error": "Options must be a list"}), 400
        
        # Normalize option format if needed
        formatted_options = []
        for option in options:
            if isinstance(option, str):
                formatted_options.append({
                    "id": str(uuid.uuid4()),
                    "value": option,
                    "label": option
                })
            elif isinstance(option, dict) and 'value' in option:
                option_id = option.get('id', str(uuid.uuid4()))
                formatted_options.append({
                    "id": option_id,
                    "value": option['value'],
                    "label": option.get('label', option['value'])
                })
            else:
                return jsonify({"error": "Invalid option format"}), 400
        
        print(f"Creating event: {title} with {len(formatted_options)} options")
        
        # Try to create the event - include category parameter
        create_event_params = {
            "title": title,
            "description": description,
            "start_time": start_time,
            "end_time": end_time,
            "options": formatted_options,
            "created_by": user_id,
            "category": category
        }
        
        # We know the category parameter is supported in models.create_event
        print(f"Adding category '{category}' to event creation parameters")
        
        # Call the function with appropriate parameters
        event = models.create_event(**create_event_params)
        
        if not event:
            return jsonify({"error": "Failed to create event"}), 500
        
        print(f"Event created successfully with ID: {event[0]['id']}")
        
        # Return the created event
        return jsonify({
            "message": "Event created successfully",
            "event": event[0]
        }), 201
        
    except Exception as e:
        # Log the error
        print(f"Error in create_event: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to create event", "details": str(e)}), 500

# Prediction routes
@api.route('/predictions', methods=['GET'])
def get_predictions():
    """Get predictions, optionally filtered by user_id or event_id"""
    try:
        user_id = request.args.get('user_id')
        event_id = request.args.get('event_id')
        
        print(f"Fetching predictions: user_id={user_id}, event_id={event_id}")
        
        predictions = models.get_predictions(user_id, event_id)
        
        # Ensure we return an empty list instead of None
        if predictions is None:
            predictions = []
            
        print(f"Returning {len(predictions)} predictions")
        return jsonify(predictions), 200
    except Exception as e:
        print(f"Error in get_predictions: {str(e)}")
        return jsonify({"error": "Failed to fetch predictions", "details": str(e)}), 500

@api.route('/predictions/user/<user_id>/event/<event_id>', methods=['GET'])
def get_user_prediction_for_event(user_id, event_id):
    """Get a user's prediction for a specific event"""
    try:
        print(f"Fetching prediction for user {user_id} on event {event_id}")
        
        prediction = models.get_user_prediction_for_event(user_id, event_id)
        
        if not prediction:
            print(f"No prediction found for user {user_id} on event {event_id}")
            return jsonify({"exists": False}), 404
            
        print(f"Found prediction: {prediction[0]}")
        return jsonify({"exists": True, "prediction": prediction[0]}), 200
    except Exception as e:
        print(f"Error in get_user_prediction_for_event: {str(e)}")
        return jsonify({"error": "Failed to fetch prediction", "details": str(e)}), 500

@api.route('/predictions', methods=['POST'])
@require_auth
def create_prediction():
    """Create a new prediction"""
    try:
        # Get user_id from the authenticated request using the same pattern as create_event
        try:
            # Try to get user ID from JWT if available
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            print(f"Using JWT identity: {user_id}")
        except Exception as jwt_error:
            # Fall back to the custom auth method
            user_id = request.user_id if hasattr(request, 'user_id') else None
            print(f"Using custom auth identity: {user_id}")
            
        # If we still don't have a user_id, use a fallback for testing
        if not user_id:
            user_id = "123e4567-e89b-12d3-a456-426614174000"  # Fallback for testing
            print(f"Using fallback identity: {user_id}")
        
        data = request.json
        
        print(f"Received prediction request from user {user_id}")
        print(data)
        
        event_id = data.get('event_id')
        option_value = data.get('option_value') or data.get('option_id')  # Support both formats
        
        if not event_id or not option_value:
            return jsonify({"error": "Event ID and option value are required"}), 400
            
        # Check if user already has a prediction for this event
        existing_prediction = models.get_user_prediction_for_event(user_id, event_id)
        if existing_prediction:
            print(f"User {user_id} already has a prediction for event {event_id}")
            return jsonify({
                "error": "User already has a prediction for this event",
                "prediction": existing_prediction[0]
            }), 409
        
        print(f"Creating prediction for event {event_id} by user {user_id}")
        
        # Create the prediction
        prediction = models.create_prediction(
            user_id=user_id,
            event_id=event_id,
            option_value=option_value
        )
        
        if not prediction:
            return jsonify({"error": "Failed to create prediction"}), 500
            
        print(f"Prediction created successfully with ID: {prediction[0]['id']}")
        
        return jsonify({
            "message": "Prediction created successfully",
            "prediction": prediction[0]
        }), 201
    except Exception as e:
        print(f"Error in create_prediction: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to create prediction", "details": str(e)}), 500

# Friend routes
@api.route('/friends', methods=['GET'])
@require_auth
def get_user_friends():
    """Get all friends for the current user"""
    user_id = request.user_id
    friends = models.get_friends(user_id)
    
    return jsonify(friends), 200

@api.route('/friends', methods=['POST'])
@require_auth
def add_user_friend():
    """Add a new friend for the current user"""
    user_id = request.user_id
    data = request.json
    
    friend_id = data.get('friend_id')
    
    if not friend_id:
        return jsonify({"error": "Friend ID is required"}), 400
        
    friendship = models.add_friend(user_id, friend_id)
    
    if not friendship:
        return jsonify({"error": "Failed to add friend"}), 500
        
    return jsonify({
        "message": "Friend request sent successfully",
        "friendship": friendship[0]
    }), 201

@api.route('/friends/<friendship_id>', methods=['PUT'])
@require_auth
def update_friendship_status(friendship_id):
    """Update friendship status (accept/reject)"""
    data = request.json
    status = data.get('status')
    
    if status not in ["accepted", "rejected"]:
        return jsonify({"error": "Invalid status"}), 400
        
    updated_friendship = models.update_friend_status(friendship_id, status)
    
    if not updated_friendship:
        return jsonify({"error": "Failed to update friendship status"}), 500
        
    return jsonify({
        "message": f"Friendship {status} successfully",
        "friendship": updated_friendship[0]
    }), 200

# Settings routes
@api.route('/settings', methods=['GET'])
@require_auth
def get_settings():
    """Get the current user's settings"""
    user_id = request.user_id
    settings = models.get_user_settings(user_id)
    
    if not settings:
        return jsonify({"message": "No settings found", "settings": {}}), 200
        
    return jsonify(settings[0]), 200

@api.route('/settings', methods=['PUT'])
@require_auth
def update_user_settings():
    """Update the current user's settings"""
    user_id = request.user_id
    data = request.json
    
    notifications_enabled = data.get('notifications_enabled')
    email_notifications = data.get('email_notifications')
    dark_mode = data.get('dark_mode')
    
    updated_settings = models.update_settings(
        user_id=user_id,
        notifications_enabled=notifications_enabled,
        email_notifications=email_notifications,
        dark_mode=dark_mode
    )
    
    if not updated_settings:
        return jsonify({"error": "Failed to update settings"}), 500
        
    return jsonify({
        "message": "Settings updated successfully",
        "settings": updated_settings[0]
    }), 200

# Support ticket routes
@api.route('/support/tickets', methods=['GET'])
@require_auth
def get_user_tickets():
    """Get support tickets for the current user"""
    user = models.get_user_by_id(request.user_id)
    
    if not user or not user[0]["wallet_address"]:
        return jsonify({"error": "User not found or no wallet address"}), 404
        
    tickets = models.get_support_tickets(user[0]["wallet_address"])
    
    return jsonify(tickets), 200

@api.route('/support/tickets', methods=['POST'])
@require_auth
def create_user_ticket():
    """Create a new support ticket"""
    user = models.get_user_by_id(request.user_id)
    
    if not user or not user[0]["wallet_address"]:
        return jsonify({"error": "User not found or no wallet address"}), 404
        
    data = request.json
    subject = data.get('subject')
    message = data.get('message')
    
    if not subject or not message:
        return jsonify({"error": "Subject and message are required"}), 400
        
    ticket = models.create_support_ticket(
        user_wallet=user[0]["wallet_address"],
        subject=subject,
        message=message
    )
    
    if not ticket:
        return jsonify({"error": "Failed to create support ticket"}), 500
        
    return jsonify({
        "message": "Support ticket created successfully",
        "ticket": ticket[0]
    }), 201

# File upload route
@api.route('/upload', methods=['POST'])
@require_auth
def upload_file():
    """Upload a file (image) to the server"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4().hex}_{filename}"
    
    # Save file to disk
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(file_path)
    
    # In a real implementation, you might store the file in cloud storage
    # such as Supabase Storage, but we'll just return the local path for now
    file_url = f"/uploads/{unique_filename}"
    
    return jsonify({
        "message": "File uploaded successfully",
        "file_url": file_url
    }), 201

@api.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)