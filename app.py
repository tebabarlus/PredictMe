from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import timedelta
import os
from dotenv import load_dotenv

from routes_supabase import api
from supabase_client import get_supabase_client

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase = get_supabase_client()

app = Flask(__name__, static_folder='HTML')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev_secret_key')
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, os.getenv('UPLOAD_FOLDER', 'uploads'))

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize extensions
CORS(app)

# Register blueprints
app.register_blueprint(api)

# Routes for serving HTML files
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'events.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

# Run the application
if __name__ == '__main__':
    app.run(debug=True)
