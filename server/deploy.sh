#!/bin/bash

# SusRadar Server Deployment Script

echo "🚀 Deploying SusRadar Server..."

# Stop existing container
echo "Stopping existing container..."
docker compose down

# Rebuild with latest changes
echo "Building updated container..."
docker compose build --no-cache

# Start the service
echo "Starting service..."
docker compose up -d

# Show logs
echo "Showing recent logs..."
docker compose logs --tail=20 -f susradar-server

echo "✅ Deployment complete!"
echo "Server should be running at http://localhost:5000"
echo "To view logs: docker compose logs -f susradar-server"