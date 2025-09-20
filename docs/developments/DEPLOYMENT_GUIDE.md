# PostgreSQL Deployment Guide for Flowise

This guide provides step-by-step instructions for deploying your Flowise application with PostgreSQL on various cloud platforms.

## 📋 Prerequisites

- Flowise application with PostgreSQL configuration files
- Cloud platform account (Render, AWS, Google Cloud, etc.)
- Basic knowledge of environment variables and database management

## 🚀 Quick Start

### 1. Prepare Your Application

```bash
# Install PostgreSQL dependencies
npm install pg dotenv

# Test your PostgreSQL configuration locally
node postgres-config.js

# Run migration script if needed
node migrate-to-postgres.js
```

### 2. Environment Variables Setup

Create a `.env` file with the following variables:

```env
# Database Configuration
DATABASE_TYPE=postgres
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=flowise
POSTGRES_USER=your-username
POSTGRES_PASSWORD=your-password
POSTGRES_SSL=true

# Connection Pool
POSTGRES_MAX_CONNECTIONS=20
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=2000

# Application Settings
NODE_ENV=production
PORT=3000
FLOWISE_USERNAME=admin
FLOWISE_PASSWORD=your-secure-password
FLOWISE_SECRETKEY_OVERWRITE=your-secret-key
```

## 🌐 Platform-Specific Deployment

### Render.com Deployment

#### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "PostgreSQL"
3. Configure:
   - **Name**: `flowise-postgres`
   - **Database Name**: `flowise`
   - **User**: `flowise_user`
   - **Region**: Choose closest to your users
   - **Plan**: Starter ($7/month) or Free (limited)

#### Step 2: Deploy Web Service

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `flowise-app`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Starter ($7/month) or Free (limited)

#### Step 3: Configure Environment Variables

In your web service settings, add these environment variables:

```env
DATABASE_TYPE=postgres
POSTGRES_HOST=[Auto-filled by Render]
POSTGRES_PORT=[Auto-filled by Render]
POSTGRES_DB=[Auto-filled by Render]
POSTGRES_USER=[Auto-filled by Render]
POSTGRES_PASSWORD=[Auto-filled by Render]
POSTGRES_SSL=true
NODE_ENV=production
FLOWISE_USERNAME=admin
FLOWISE_PASSWORD=your-secure-password
FLOWISE_SECRETKEY_OVERWRITE=your-secret-key
```

#### Step 4: Initialize Database Schema

1. Connect to your PostgreSQL database using Render's shell or external client
2. Run the schema setup:
   ```sql
   \i postgresql-setup.sql
   ```

### AWS RDS Deployment

#### Step 1: Create RDS PostgreSQL Instance

1. Go to AWS RDS Console
2. Click "Create database"
3. Choose:
   - **Engine**: PostgreSQL
   - **Version**: 15.x or later
   - **Template**: Free tier (for testing) or Production
   - **DB Instance Identifier**: `flowise-postgres`
   - **Master Username**: `postgres`
   - **Master Password**: Set a secure password

#### Step 2: Configure Security Groups

1. Create a security group allowing inbound traffic on port 5432
2. Add your application's IP range or security group

#### Step 3: Deploy Application

Use AWS Elastic Beanstalk, ECS, or EC2:

```env
DATABASE_TYPE=postgres
POSTGRES_HOST=your-rds-endpoint.region.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DB=flowise
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-rds-password
POSTGRES_SSL=true
```

### Google Cloud SQL Deployment

#### Step 1: Create Cloud SQL PostgreSQL Instance

```bash
# Using gcloud CLI
gcloud sql instances create flowise-postgres \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1

# Create database
gcloud sql databases create flowise --instance=flowise-postgres

# Create user
gcloud sql users create flowise-user \
    --instance=flowise-postgres \
    --password=your-secure-password
```

#### Step 2: Deploy to Cloud Run

```bash
# Build and deploy
gcloud run deploy flowise-app \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated
```

### Heroku Postgres Deployment

#### Step 1: Create Heroku App

```bash
# Create app
heroku create your-flowise-app

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Get database URL
heroku config:get DATABASE_URL
```

#### Step 2: Configure Environment Variables

```bash
heroku config:set DATABASE_TYPE=postgres
heroku config:set NODE_ENV=production
heroku config:set FLOWISE_USERNAME=admin
heroku config:set FLOWISE_PASSWORD=your-secure-password
heroku config:set FLOWISE_SECRETKEY_OVERWRITE=your-secret-key
```

#### Step 3: Deploy

```bash
git push heroku main
```

## 🔧 Post-Deployment Setup

### 1. Database Schema Initialization

After deploying, initialize your database schema:

```bash
# Connect to your PostgreSQL database
psql "postgresql://username:password@host:port/database?sslmode=require"

# Run the setup script
\i postgresql-setup.sql
```

### 2. Verify Deployment

1. **Health Check**: Visit `https://your-app-url/api/v1/ping`
2. **Database Connection**: Check application logs for successful database connection
3. **Admin Login**: Try logging in with your admin credentials

### 3. Create Additional Users

Use the admin interface or run SQL commands:

```sql
-- Create a new user
INSERT INTO "user" (id, name, email, status, "createdDate", "updatedDate")
VALUES (
    gen_random_uuid(),
    'John Doe',
    'john@example.com',
    'ACTIVE',
    NOW(),
    NOW()
);
```

## 🔍 Monitoring and Maintenance

### Database Monitoring

1. **Connection Pool**: Monitor active connections
2. **Query Performance**: Use `pg_stat_statements` extension
3. **Storage Usage**: Monitor database size growth

### Backup Strategy

```bash
# Create backup
pg_dump "postgresql://username:password@host:port/database" > backup-$(date +%Y%m%d).sql

# Restore backup
psql "postgresql://username:password@host:port/database" < backup-20240115.sql
```

### Performance Optimization

1. **Indexes**: Ensure proper indexing on frequently queried columns
2. **Connection Pooling**: Use connection pooling for better performance
3. **Query Optimization**: Monitor slow queries and optimize them

## 🚨 Troubleshooting

### Common Issues

#### Connection Refused
```bash
# Check if PostgreSQL is running
pg_isready -h your-host -p 5432

# Verify connection string
node -e "require('./postgres-config').DatabaseUtils.testConnection()"
```

#### SSL Connection Issues
```env
# Try different SSL modes
POSTGRES_SSL=true
POSTGRES_SSL_MODE=require
# or
POSTGRES_SSL_MODE=prefer
```

#### Migration Errors
```bash
# Check current schema
psql -c "\dt" your-database-url

# Run migration manually
node migrate-to-postgres.js
```

### Logs and Debugging

1. **Application Logs**: Check your platform's logging system
2. **Database Logs**: Enable PostgreSQL logging for debugging
3. **Connection Logs**: Monitor connection attempts and failures

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Render PostgreSQL Guide](https://render.com/docs/databases)
- [AWS RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Google Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Heroku Postgres](https://devcenter.heroku.com/articles/heroku-postgresql)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review application and database logs
3. Verify environment variables are correctly set
4. Test database connectivity using the provided utilities
5. Consult your cloud platform's documentation

---

**Note**: Always use strong passwords and enable SSL/TLS for production deployments. Regularly backup your database and monitor performance metrics.