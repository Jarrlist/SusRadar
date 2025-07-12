#!/usr/bin/env python3
"""
SusRadar Server - Flask API for managing suspicious website data
Stores data in JSON files for simplicity and provides REST API endpoints
"""

import os
import json
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import jwt
import bcrypt

app = Flask(__name__)
# Configure CORS - allow Chrome extensions and local development
CORS(app, 
     origins=["chrome-extension://*", "http://localhost:*", "http://127.0.0.1:*", "http://raspberrypi.local:*"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"])

# Configure logging
log_handlers = [logging.StreamHandler()]

# Try to add file handler, but don't fail if directory doesn't exist or isn't writable
try:
    os.makedirs('./logs', exist_ok=True)
    log_handlers.append(logging.FileHandler('./logs/susradar.log'))
    print("File logging enabled")
except (PermissionError, OSError) as e:
    print(f"File logging disabled due to: {e}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=log_handlers
)
logger = logging.getLogger(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['DATA_DIR'] = os.environ.get('DATA_DIR', './data')
app.config['JWT_EXPIRATION_HOURS'] = int(os.environ.get('JWT_EXPIRATION_HOURS', '24'))

# Ensure data directory exists
os.makedirs(app.config['DATA_DIR'], exist_ok=True)

logger.info("SusRadar server starting up...")
logger.info(f"Data directory: {app.config['DATA_DIR']}")
logger.info(f"JWT expiration: {app.config['JWT_EXPIRATION_HOURS']} hours")

class DataManager:
    """Handles file-based JSON storage for user data"""
    
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.users_file = os.path.join(data_dir, 'users.json')
        
    def get_user_data_file(self, username):
        """Get the path to a user's data file"""
        safe_username = hashlib.sha256(username.encode()).hexdigest()[:16]
        return os.path.join(self.data_dir, f'user_{safe_username}.json')
    
    def load_users(self):
        """Load users database"""
        if not os.path.exists(self.users_file):
            return {}
        try:
            with open(self.users_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    
    def save_users(self, users_data):
        """Save users database"""
        with open(self.users_file, 'w') as f:
            json.dump(users_data, f, indent=2)
    
    def load_user_data(self, username):
        """Load a user's SusRadar data"""
        user_file = self.get_user_data_file(username)
        if not os.path.exists(user_file):
            return {"companies": {}, "mappings": {}}
        try:
            with open(user_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {"companies": {}, "mappings": {}}
    
    def save_user_data(self, username, data):
        """Save a user's SusRadar data"""
        user_file = self.get_user_data_file(username)
        data['last_updated'] = datetime.utcnow().isoformat()
        with open(user_file, 'w') as f:
            json.dump(data, f, indent=2)

# Initialize data manager
data_manager = DataManager(app.config['DATA_DIR'])

def token_required(f):
    """Decorator to require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data['username']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'susradar-server'})

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    logger.info(f"Registration attempt from {request.remote_addr}")
    
    try:
        data = request.get_json()
        logger.info(f"Received registration data: {data}")
        
        if not data or not data.get('username') or not data.get('password'):
            logger.warning("Registration failed: Missing username or password")
            return jsonify({'error': 'Username and password required'}), 400
        
        username = data['username'].lower().strip()
        password = data['password']
        
        logger.info(f"Registration attempt for username: {username}")
        
        # Validate username (alphanumeric + underscore, 3-30 chars)
        if not username.replace('_', '').isalnum() or len(username) < 3 or len(username) > 30:
            logger.warning(f"Registration failed: Invalid username format: {username}")
            return jsonify({'error': 'Username must be 3-30 characters, alphanumeric and underscore only'}), 400
        
        # Validate password (minimum 8 characters)
        if len(password) < 8:
            logger.warning(f"Registration failed: Password too short for user: {username}")
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        
        logger.info("Loading existing users...")
        users = data_manager.load_users()
        logger.info(f"Found {len(users)} existing users")
        
        if username in users:
            logger.warning(f"Registration failed: Username already exists: {username}")
            return jsonify({'error': 'Username already exists'}), 409
        
        logger.info(f"Hashing password for user: {username}")
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        logger.info(f"Saving user data for: {username}")
        # Save user
        users[username] = {
            'password_hash': password_hash,
            'created_at': datetime.utcnow().isoformat(),
            'last_login': None
        }
        data_manager.save_users(users)
        
        logger.info(f"Initializing empty data for user: {username}")
        # Initialize empty user data
        data_manager.save_user_data(username, {"companies": {}, "mappings": {}})
        
        logger.info(f"Registration successful for user: {username}")
        return jsonify({'message': 'User registered successfully'}), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token"""
    logger.info(f"Login attempt from {request.remote_addr}")
    
    try:
        data = request.get_json()
        logger.info(f"Received login data: {data}")
        
        if not data or not data.get('username') or not data.get('password'):
            logger.warning("Login failed: Missing username or password")
            return jsonify({'error': 'Username and password required'}), 400
        
        username = data['username'].lower().strip()
        password = data['password']
        
        logger.info(f"Login attempt for username: {username}")
        
        users = data_manager.load_users()
        user = users.get(username)
        
        if not user:
            logger.warning(f"Login failed: User not found: {username}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            logger.warning(f"Login failed: Invalid password for user: {username}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        logger.info(f"Login successful for user: {username}")
        
        # Update last login
        user['last_login'] = datetime.utcnow().isoformat()
        data_manager.save_users(users)
        
        # Generate JWT token
        token_payload = {
            'username': username,
            'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
        }
        token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')
        
        logger.info(f"JWT token generated for user: {username}")
        
        return jsonify({
            'token': token,
            'username': username,
            'expires_in': app.config['JWT_EXPIRATION_HOURS'] * 3600
        })
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/api/data', methods=['GET'])
@token_required
def get_user_data(current_user):
    """Get all SusRadar data for the authenticated user"""
    user_data = data_manager.load_user_data(current_user)
    return jsonify(user_data)

@app.route('/api/data', methods=['POST'])
@token_required
def save_user_data(current_user):
    """Save SusRadar data for the authenticated user"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Validate data structure
    if not isinstance(data, dict) or 'companies' not in data or 'mappings' not in data:
        return jsonify({'error': 'Invalid data structure'}), 400
    
    data_manager.save_user_data(current_user, data)
    return jsonify({'message': 'Data saved successfully'})

@app.route('/api/data/sync', methods=['POST'])
@token_required
def sync_data(current_user):
    """Sync data with client - merge changes intelligently"""
    client_data = request.get_json()
    if not client_data:
        return jsonify({'error': 'No data provided'}), 400
    
    server_data = data_manager.load_user_data(current_user)
    
    # Simple merge strategy: client wins for conflicts
    # In a production system, you'd want more sophisticated conflict resolution
    merged_data = {
        'companies': {**server_data.get('companies', {}), **client_data.get('companies', {})},
        'mappings': {**server_data.get('mappings', {}), **client_data.get('mappings', {})}
    }
    
    data_manager.save_user_data(current_user, merged_data)
    
    return jsonify({
        'message': 'Data synchronized successfully',
        'data': merged_data
    })

@app.route('/api/companies/<company_id>', methods=['DELETE'])
@token_required
def delete_company(current_user, company_id):
    """Delete a specific company and its mappings"""
    user_data = data_manager.load_user_data(current_user)
    
    # Remove company
    if company_id in user_data['companies']:
        del user_data['companies'][company_id]
    
    # Remove all mappings to this company
    user_data['mappings'] = {
        url: cid for url, cid in user_data['mappings'].items() 
        if cid != company_id
    }
    
    data_manager.save_user_data(current_user, user_data)
    
    return jsonify({'message': 'Company deleted successfully'})

@app.before_request
def log_request_info():
    logger.info(f"Request: {request.method} {request.url} from {request.remote_addr}")
    logger.info(f"Request headers: {dict(request.headers)}")
    
    # Only try to parse JSON if there's actually content
    if request.content_length and request.content_length > 0:
        try:
            data = request.get_json()
            if data:
                # Don't log passwords
                safe_data = {k: v if k != 'password' else '***' for k, v in data.items()}
                logger.info(f"Request body: {safe_data}")
        except Exception as e:
            logger.info(f"Could not parse request body as JSON: {e}")

@app.after_request  
def log_response_info(response):
    logger.info(f"Response: {response.status_code}")
    return response

@app.errorhandler(404)
def not_found(error):
    logger.warning(f"404 error: {request.url} not found")
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 error: {str(error)}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)