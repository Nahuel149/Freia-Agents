# Flowise Development Setup Guide

This guide explains how to run Flowise in development mode.

## Prerequisites

- Node.js (version 18 or higher)
- npm or pnpm package manager

## Development Setup

### 1. Install Dependencies

From the root directory, install all dependencies:

```bash
npm install
# or
pnpm install
```

### 2. Running the Application

Flowise consists of two main components that need to be run separately:

#### Frontend Server (UI)

**Location**: Root directory  
**Command**: `npm run dev`  
**Port**: http://localhost:8080  

```bash
# From the root directory
npm run dev
```

#### Backend Server (API)

**Location**: `packages/server/`  
**Command**: `npm start`  
**Port**: http://localhost:3000  

```bash
# From the root directory
cd packages/server
npm start
```

### 3. Environment Configuration

The backend server uses environment variables for configuration. Make sure you have a `.env` file in `packages/server/` with the following basic settings:

```env
PORT=3000
DEBUG=true
LOG_LEVEL=info
FORCE_OSS=true
```

You can copy from `.env.example` and modify as needed:

```bash
cd packages/server
cp .env.example .env
```

### 4. Accessing the Application

Once both servers are running:

1. **Frontend UI**: Open http://localhost:8080 in your browser
2. **Backend API**: Available at http://localhost:3000 (used by the frontend)

### 5. Development Workflow

1. Start the backend server first: `cd packages/server && npm start`
2. In a new terminal, start the frontend: `npm run dev` (from root)
3. The frontend will automatically connect to the backend API

### Troubleshooting

- **401 Unauthorized errors**: Make sure the backend server is running on port 3000
- **pnpm not found**: Use `npm` commands instead, or install pnpm globally
- **Port conflicts**: Check if ports 3000 and 8081 are available

### Project Structure

```
Flowise/
├── packages/
│   ├── server/          # Backend API server
│   ├── ui/              # Frontend React application
│   └── components/      # Shared components
├── package.json         # Root package.json with dev script
└── DEVELOPMENT.md       # This file
```

## Additional Commands

- **Build**: `npm run build` (from root)
- **Test**: `npm test` (from respective package directories)
- **Clean**: `npm run clean` (from server directory)

For more detailed information, check the README files in each package directory.