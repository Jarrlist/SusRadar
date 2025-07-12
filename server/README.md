# SusRadar Server

Flask-based API server for storing and managing SusRadar data across multiple devices and users.

## Features

- **File-based JSON storage** - Simple and reliable data persistence
- **JWT Authentication** - Secure user authentication and session management
- **Multi-user support** - Each user has isolated data storage
- **Docker containerization** - Easy deployment on Raspberry Pi or any server
- **RESTful API** - Clean API design for Chrome extension integration
- **CORS support** - Allows Chrome extension to communicate securely

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login and receive JWT token

### Data Management
- `GET /api/data` - Get all SusRadar data for authenticated user
- `POST /api/data` - Save complete SusRadar data
- `POST /api/data/sync` - Sync and merge data with client
- `DELETE /api/companies/<id>` - Delete specific company

### System
- `GET /health` - Health check endpoint

## Quick Start

### Using Docker (Recommended)

1. Clone and navigate to server directory:
```bash
cd server
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env and set a strong SECRET_KEY
```

3. Build and run with Docker Compose:
```bash
docker-compose up -d
```

The server will be available at `http://localhost:5000`

### Development Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export FLASK_ENV=development
export SECRET_KEY=your-dev-secret-key
```

3. Run the server:
```bash
python app.py
```

## Configuration

Environment variables:

- `SECRET_KEY` - JWT secret key (required)
- `DATA_DIR` - Directory for data storage (default: ./data)
- `JWT_EXPIRATION_HOURS` - Token expiration time (default: 24)
- `PORT` - Server port (default: 5000)
- `FLASK_ENV` - Environment mode (development/production)

## Data Storage

User data is stored in JSON files:
- `data/users.json` - User accounts and authentication
- `data/user_<hash>.json` - Individual user's SusRadar data

## Security

- Passwords are hashed with bcrypt
- JWT tokens for stateless authentication
- CORS configured for Chrome extension origins
- Non-root user in Docker container
- Input validation and sanitization

## Deployment on Raspberry Pi

1. Install Docker on your Raspberry Pi
2. Copy server files to Pi
3. Set strong SECRET_KEY in .env
4. Run with docker-compose
5. Configure your router/firewall as needed

## Integration with Chrome Extension

The Chrome extension needs to be updated to:
1. Authenticate with server on startup
2. Sync data on extension initialization
3. Send updates to server when data changes
4. Handle offline scenarios gracefully