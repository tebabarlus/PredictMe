# PredictMe Backend

This is the Python backend for the PredictMe application. It provides API endpoints to power the prediction platform.

## Features

- User Authentication (username/password and wallet-based)
- Prediction creation and management
- Voting on predictions
- Comments on predictions
- Category filtering
- User profiles and statistics
- Image upload for predictions

## Setup Instructions

1. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Run the Flask application:
   ```
   python app.py
   ```

3. The server will start on http://localhost:5000

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login with username/password or wallet

### Users
- GET `/api/user/profile` - Get user profile with stats
- PUT `/api/user/profile` - Update user profile

### Predictions
- GET `/api/predictions` - Get all predictions (filter by category)
- GET `/api/predictions/<id>` - Get a specific prediction
- POST `/api/predictions` - Create a new prediction
- POST `/api/predictions/<id>/vote` - Vote on a prediction

### Comments
- GET `/api/predictions/<id>/comments` - Get comments for a prediction
- POST `/api/predictions/<id>/comments` - Add a comment to a prediction

### Categories
- GET `/api/categories` - Get all available categories

### Images
- POST `/api/upload` - Upload an image
- GET `/api/uploads/<filename>` - Access an uploaded image

## Database Structure

The application uses SQLite with SQLAlchemy ORM. The main models are:
- User
- Prediction
- Vote
- Category
- Image
- Transaction
- Comment

## Frontend Integration

The backend serves the static HTML files from the `HTML` directory and provides API endpoints for the frontend to interact with.
