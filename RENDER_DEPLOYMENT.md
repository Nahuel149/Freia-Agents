# Deploying Freia (Flowise OSS) to Render

This guide will help you deploy your Freia codebase to Render using the optimized configuration files.

## Prerequisites

1. A Render account (sign up at [render.com](https://render.com))
2. Your Freia repository pushed to GitHub (we're using `https://github.com/Nahuel149/Freia-Agents`)
3. The repository should be public or you need to connect your GitHub account to Render

## Deployment Steps

### Step 1: Prepare Your Repository

1. Ensure your latest changes are committed and pushed to your GitHub repository:
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push origin agent-improvements
   ```

### Step 2: Create a New Web Service on Render

1. **Login to Render Dashboard**
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - Click "New +" → "Web Service"

2. **Connect Your Repository**
   - Select "Build and deploy from a Git repository"
   - Connect your GitHub account if not already connected
   - Select your `Freia-Agents` repository
   - Choose the `agent-improvements` branch (or your preferred branch)

3. **Configure Basic Settings**
   - **Name**: `freia-flowise` (or your preferred name)
   - **Region**: Choose your preferred region (e.g., Oregon)
   - **Branch**: `agent-improvements`
   - **Runtime**: `Docker`

### Step 3: Configure Docker Settings

1. **Docker Configuration**
   - **Dockerfile Path**: `Dockerfile.render`
   - **Docker Context**: `.` (root directory)
   - **Docker Build Command**: Leave empty (uses default)

### Step 4: Set Environment Variables

Add the following environment variables in the Render dashboard:

#### Required Variables:
```
NODE_ENV=production
NODE_VERSION=20
PORT=10000
HOST=0.0.0.0
```

#### Storage Paths (for persistent data):
```
DATABASE_PATH=/opt/render/project/.flowise
APIKEY_PATH=/opt/render/project/.flowise
SECRETKEY_PATH=/opt/render/project/.flowise
LOG_PATH=/opt/render/project/.flowise/logs
BLOB_STORAGE_PATH=/opt/render/project/.flowise/storage
```

#### Application Settings:
```
DISABLE_FLOWISE_TELEMETRY=true
SHOW_COMMUNITY_NODES=true
CORS_ORIGINS=*
IFRAME_ORIGINS=*
FLOWISE_FILE_SIZE_LIMIT=50mb
```

#### Authentication (Generate secure random values):
```
JWT_AUTH_TOKEN_SECRET=<generate-32-char-random-string>
JWT_REFRESH_TOKEN_SECRET=<generate-32-char-random-string>
JWT_ISSUER=FREIA_FLOWISE
JWT_AUDIENCE=FREIA_USERS
JWT_TOKEN_EXPIRY_IN_MINUTES=360
JWT_REFRESH_TOKEN_EXPIRY_IN_MINUTES=43200
```

**To generate secure tokens:**
```bash
# Generate random 32-character strings
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Configure Persistent Storage

1. **Add a Disk**
   - In your service settings, go to "Disks"
   - Click "Add Disk"
   - **Name**: `freia-data`
   - **Mount Path**: `/opt/render/project/.flowise`
   - **Size**: 1 GB (or more based on your needs)

### Step 6: Advanced Settings

1. **Health Check**
   - **Health Check Path**: `/api/v1/ping`
   - **Health Check Grace Period**: 300 seconds

2. **Auto-Deploy**
   - Enable "Auto-Deploy" if you want automatic deployments on git push

### Step 7: Deploy

1. Click "Create Web Service"
2. Render will start building your application
3. Monitor the build logs for any issues
4. Once deployed, you'll get a URL like `https://freia-flowise.onrender.com`

## Post-Deployment Configuration

### Optional: Custom Domain

1. Go to your service settings
2. Click "Custom Domains"
3. Add your domain and configure DNS

### Optional: Authentication Setup

If you want to add basic authentication:

```
FLOWISE_USERNAME=your-username
FLOWISE_PASSWORD=your-secure-password
```

## Troubleshooting

### Common Issues:

1. **Build Failures**
   - Check the build logs in Render dashboard
   - Ensure all dependencies are properly listed in package.json
   - Verify the Dockerfile.render is being used

2. **Memory Issues**
   - Consider upgrading to a higher tier plan
   - The Starter plan has 512MB RAM, which might be limiting

3. **Storage Issues**
   - Ensure the disk is properly mounted
   - Check that environment variables point to the correct paths

4. **Port Issues**
   - Render automatically sets the PORT environment variable
   - Make sure your app listens on `process.env.PORT || 10000`

### Logs and Monitoring

- Access logs through the Render dashboard
- Use the "Shell" feature to debug issues
- Monitor resource usage in the metrics tab

## Scaling and Performance

- **Starter Plan**: Good for development/testing
- **Standard Plan**: Recommended for production use
- **Pro Plan**: For high-traffic applications

## Security Considerations

1. **Environment Variables**: Never commit secrets to your repository
2. **CORS Settings**: Restrict CORS_ORIGINS in production
3. **Authentication**: Enable FLOWISE_USERNAME/PASSWORD for production
4. **HTTPS**: Render provides SSL certificates automatically

## Maintenance

- **Updates**: Push to your connected branch to trigger deployments
- **Backups**: Consider backing up your persistent disk data
- **Monitoring**: Set up alerts for service health

## Cost Optimization

- Use the Starter plan for development
- Monitor resource usage to choose the right plan
- Consider using a database service for larger deployments

---

**Your Freia application should now be successfully deployed on Render!**

Access your application at the provided Render URL and start building your AI workflows.