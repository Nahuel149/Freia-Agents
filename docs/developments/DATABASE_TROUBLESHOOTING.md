# Database Detection Troubleshooting Guide

This guide helps resolve database detection issues when deploying Freia to Render.

## Common Issue: "Database not detected"

If you're seeing a "database not detected" error even after setting all environment variables, this is likely due to one of the following issues:

### 1. Environment Variable Override

**Problem**: The startup script was overriding the `DATABASE_TYPE` environment variable.

**Solution**: The startup script has been updated to not override `DATABASE_TYPE`. Make sure you have set `DATABASE_TYPE=sqlite` in your Render environment variables.

### 2. Missing Environment Variables

**Required Environment Variables for SQLite on Render**:
```bash
DATABASE_TYPE=sqlite
DATABASE_PATH=/opt/render/project/.flowise
```

**Complete Environment Variables List**:
```bash
# Database Configuration
DATABASE_TYPE=sqlite
DATABASE_PATH=/opt/render/project/.flowise

# Admin User (customize as needed)
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=YourSecurePassword123!
ADMIN_NAME=Admin

# Application Paths
APIKEY_PATH=/opt/render/project/.flowise
SECRETKEY_PATH=/opt/render/project/.flowise
LOG_PATH=/opt/render/project/.flowise/logs
BLOB_STORAGE_PATH=/opt/render/project/.flowise/storage

# Application Settings
DEBUG=true
LOG_LEVEL=debug
FLOWISE_USERNAME=admin
FLOWISE_PASSWORD=1234
FLOWISE_FILE_SIZE_LIMIT=50mb

# JWT Configuration (Generate these in Render)
JWT_SECRET=[Generate Value]
JWTREFRESHTOKEN_SECRET=[Generate Value]
JWT_EXPIRE=7d
JWTREFRESHTOKEN_EXPIRE=30d

# System Configuration
PUPPETEER_SKIP_DOWNLOAD=true
NODE_OPTIONS=--max-old-space-size=4096
NPM_CONFIG_AUDIT_LEVEL=moderate
```

### 3. Database Initialization Issues

**Diagnostic Scripts**:

Two new diagnostic scripts have been added to help troubleshoot:

1. **Environment Debug Script** (`scripts/debug-env.js`):
   - Shows all environment variables
   - Checks file system status
   - Tests basic database connectivity

2. **Database Connection Test** (`scripts/test-db-connection.js`):
   - Tests DataSource initialization
   - Runs database migrations
   - Verifies database structure

### 4. Render Deployment Process

The updated deployment process:

1. **Environment Setup**: Sets required environment variables
2. **Debug Information**: Runs diagnostic scripts
3. **Database Test**: Tests database connectivity and initialization
4. **Admin User Creation**: Creates admin user if database is ready
5. **Application Start**: Starts the main application

### 5. Troubleshooting Steps

If you're still experiencing issues:

1. **Check Render Logs**:
   - Look for the debug output from `debug-env.js`
   - Check if the database test script runs successfully
   - Verify environment variables are set correctly

2. **Verify Environment Variables**:
   - Ensure `DATABASE_TYPE=sqlite` is set
   - Confirm `DATABASE_PATH=/opt/render/project/.flowise`
   - Check that the disk is properly mounted

3. **Check Disk Configuration**:
   - Verify the `freia-data` disk is created
   - Ensure it's mounted at `/opt/render/project/.flowise`
   - Confirm the disk size is adequate (recommended: 1GB+)

4. **Review Build Logs**:
   - Check if the build process completes successfully
   - Look for any errors during dependency installation
   - Verify the application builds without errors

### 6. Database Detection Logic

The application detects the database type using this logic:

```javascript
switch (process.env.DATABASE_TYPE) {
    case 'sqlite':
        // Uses DATABASE_PATH or defaults to .flowise directory
        database: path.resolve(homePath, 'database.sqlite')
        break;
    case 'mysql':
    case 'mariadb':
    case 'postgres':
        // Uses DATABASE_HOST, DATABASE_PORT, etc.
        break;
    default:
        // Defaults to SQLite if DATABASE_TYPE is not set
        database: path.resolve(homePath, 'database.sqlite')
}
```

### 7. Common Render-Specific Issues

1. **Disk Not Mounted**: Ensure the persistent disk is properly configured
2. **Permission Issues**: The application runs as a non-root user
3. **Environment Variable Timing**: Variables must be set before deployment
4. **Build Cache**: Clear build cache if experiencing persistent issues

### 8. Success Indicators

You'll know the database is working when you see:

```
✅ DataSource initialized successfully
🔄 Database migrations completed successfully
🔐 Identity Manager initialized successfully
👤 Admin user created successfully
```

### 9. Getting Help

If issues persist:

1. Check the Render deployment logs for specific error messages
2. Run the diagnostic scripts locally to compare behavior
3. Verify all environment variables match the required format
4. Ensure the persistent disk is properly configured and mounted

## Updated Files

The following files have been updated to resolve database detection issues:

- `render-startup.sh`: Removed DATABASE_TYPE override, added diagnostics
- `debug-env.js`: New diagnostic script for environment debugging
- `test-db-connection.js`: New script for database connectivity testing
- `render.yaml`: Updated with all required environment variables
- `Dockerfile.render`: Updated to use the new startup script

These changes should resolve the database detection issue and provide better debugging information for future deployments.