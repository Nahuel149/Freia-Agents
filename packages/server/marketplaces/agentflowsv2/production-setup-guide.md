# B2B Sales System - Production Setup Guide

## Overview
This guide will help you deploy the B2B Sales System to your Render PostgreSQL database in production.

## Prerequisites
- Render PostgreSQL database: `freia-postgres` (dpg-d2u0qtmr433s73dresng-a)
- Database credentials with write access
- Node.js environment

## Database Information
- **Database Name**: freia_postgres
- **User**: freia_postgres_user
- **Host**: dpg-d2u0qtmr433s73dresng-a.render.com (external) or dpg-d2u0qtmr433s73dresng-a (internal)
- **Port**: 5432
- **Region**: Oregon
- **Plan**: Basic 256MB

## Setup Steps

### Step 1: Get Database Connection String
1. Go to your Render Dashboard: https://dashboard.render.com/d/dpg-d2u0qtmr433s73dresng-a
2. Copy the **External Database URL** or **Internal Database URL**
3. The URL format should be: `postgresql://username:password@host:port/database`

### Step 2: Set Environment Variables
Create a `.env.production` file with:
```bash
DATABASE_URL=postgresql://freia_postgres_user:YOUR_PASSWORD@dpg-d2u0qtmr433s73dresng-a.render.com:5432/freia_postgres
POSTGRES_PASSWORD=YOUR_PASSWORD
FLOWISE_URL=https://your-flowise-app.render.com
NODE_ENV=production
B2B_SYSTEM_ENABLED=true
```

### Step 3: Run Production Setup
```bash
# Install dependencies
npm install pg

# Run the production setup script
node packages/server/marketplaces/agentflowsv2/deploy-production.js
```

### Step 4: Manual Database Setup (Alternative)
If the automated script fails, you can manually execute the SQL commands:

1. Connect to your database using psql or a GUI tool:
```bash
psql "postgresql://freia_postgres_user:YOUR_PASSWORD@dpg-d2u0qtmr433s73dresng-a.render.com:5432/freia_postgres"
```

2. Execute the schema from `b2b_sales_schema.sql`:
```bash
\i packages/server/marketplaces/agentflowsv2/b2b_sales_schema.sql
```

### Step 5: Verify Installation
Run this query to verify tables were created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customers', 'sales', 'follow_ups');
```

### Step 6: Import Flowise Templates
1. Access your Flowise instance
2. Import the chatflow templates from `flowise-templates.json`
3. Configure the database connections in the templates

## Production Configuration

### Environment Variables for Render Web Service
Add these to your Render web service environment:
```
DATABASE_URL=postgresql://freia_postgres_user:PASSWORD@dpg-d2u0qtmr433s73dresng-a:5432/freia_postgres
POSTGRES_HOST=dpg-d2u0qtmr433s73dresng-a
POSTGRES_PORT=5432
POSTGRES_DB=freia_postgres
POSTGRES_USER=freia_postgres_user
POSTGRES_PASSWORD=YOUR_PASSWORD
FLOWISE_URL=https://your-flowise-app.render.com
B2B_SYSTEM_ENABLED=true
NODE_ENV=production
```

### Database Schema Overview
The system creates three main tables:

1. **customers** - Store customer information and lead data
2. **sales** - Track sales transactions and deals
3. **follow_ups** - Manage follow-up tasks and communications

### Features Included
- Automatic timestamp updates
- Foreign key relationships
- Indexes for performance
- Sample data for testing
- Trigger functions for audit trails

## Testing the System

### 1. Test Database Connection
```javascript
const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.connect()
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Connection failed:', err));
```

### 2. Test Sample Queries
```sql
-- Check customers
SELECT COUNT(*) FROM customers;

-- Check sales
SELECT COUNT(*) FROM sales;

-- Check follow-ups
SELECT COUNT(*) FROM follow_ups;
```

### 3. Test Flowise Integration
- Send a test message to your WhatsApp bot
- Verify data is being stored in the database
- Check that follow-ups are being created

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Ensure you're using the correct external hostname
   - Check if SSL is properly configured
   - Verify firewall settings

2. **Permission Denied**
   - Confirm you have the correct database password
   - Check user permissions in Render dashboard

3. **Table Already Exists**
   - This is normal if running setup multiple times
   - The script uses `IF NOT EXISTS` to handle this

4. **SSL Connection Issues**
   - Add `ssl: { rejectUnauthorized: false }` to connection config
   - Or use `?sslmode=require` in connection string

### Getting Help
- Check Render dashboard logs
- Review database connection settings
- Verify environment variables are set correctly

## Next Steps

1. **Monitor Performance**
   - Use Render metrics to monitor database usage
   - Set up alerts for high connection counts

2. **Backup Strategy**
   - Render provides automatic backups
   - Consider additional backup solutions for critical data

3. **Scaling**
   - Monitor database size and performance
   - Upgrade plan if needed
   - Consider read replicas for high traffic

4. **Security**
   - Regularly rotate database passwords
   - Review IP allowlist settings
   - Monitor access logs

## Support
For issues with this setup, check:
- Render documentation: https://render.com/docs/databases
- PostgreSQL documentation
- Flowise documentation