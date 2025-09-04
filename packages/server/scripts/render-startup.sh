#!/bin/bash

# Render Startup Script for Freia Flowise
# This script handles database initialization and admin user creation

set -e  # Exit on any error

echo "🚀 [render-startup]: Starting Freia Flowise deployment..."

# Environment variables
export NODE_ENV=production
# Don't override DATABASE_TYPE - let Render environment variables take precedence
export DATABASE_PATH=${DATABASE_PATH:-/opt/render/project/.flowise}
export ADMIN_EMAIL=${ADMIN_EMAIL:-admin@freia.ai}
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-Testing123!}
export ADMIN_NAME=${ADMIN_NAME:-Admin}

# Debug environment variables
echo "🔍 [render-startup]: Environment debug info:"
echo "DATABASE_TYPE: $DATABASE_TYPE"
echo "DATABASE_PATH: $DATABASE_PATH"
node scripts/debug-env.js

echo "📁 [render-startup]: Database path: $DATABASE_PATH"
echo "📧 [render-startup]: Admin email: $ADMIN_EMAIL"
echo "👤 [render-startup]: Admin name: $ADMIN_NAME"

# Ensure the .flowise directory exists
echo "📁 [render-startup]: Creating .flowise directory..."
mkdir -p "$DATABASE_PATH"
mkdir -p "$DATABASE_PATH/logs"
mkdir -p "$DATABASE_PATH/storage"

# Change to the server directory
cd /opt/render/project/packages/server

echo "📦 [render-startup]: Installing dependencies..."
npm ci --only=production

echo "🔧 [render-startup]: Building application..."
npm run build

echo "🧪 [render-startup]: Testing database connection..."
node scripts/test-db-connection.js

echo "🗄️  [render-startup]: Database test completed, proceeding with startup..."
# The test script already initializes the database and runs migrations
# No need to start/stop the application for database initialization

# Wait a moment for clean shutdown
sleep 5

# Check if database was created
if [ -f "$DATABASE_PATH/database.sqlite" ]; then
    echo "✅ [render-startup]: Database file created successfully"
    
    # Install better-sqlite3 for admin user creation
    echo "📦 [render-startup]: Installing better-sqlite3 for admin user creation..."
    npm install better-sqlite3
    
    # Create admin user
    echo "👤 [render-startup]: Creating admin user..."
    node scripts/init-admin-user.js
else
    echo "⚠️  [render-startup]: Database file not found, admin user creation will be handled by application"
fi

echo "🎉 [render-startup]: Initialization completed, starting application..."

# Start the application normally
exec node dist/index.js