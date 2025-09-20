# PostgreSQL Database Setup for Flowise Application

This guide will help you set up your own PostgreSQL database for your Flowise application users, replicating all necessary columns and fields from the existing codebase.

## 📋 Overview

This setup includes:
- **Core Application Tables**: `chat_flow`, `chat_message`, `credential`, `tool`, `api_key`, `assistant`
- **User Management Tables**: `user`, `organization`, `role`, `workspace`, `login_method`
- **Relationship Tables**: `organization_user`, `workspace_user`
- **Audit Tables**: `login_activity`

## 🚀 Quick Start

### 1. Prerequisites

- PostgreSQL 12+ installed locally or access to a cloud PostgreSQL service
- Node.js and npm installed
- Access to your Flowise codebase

### 2. Install Required Dependencies

```bash
npm install pg dotenv
```

### 3. Set Up Environment Variables

Create a `.env` file in your project root:

```env
# PostgreSQL Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=flowise
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here

# Connection Pool Settings
POSTGRES_MAX_CONNECTIONS=20
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=2000

# Application Settings
NODE_ENV=production
DATABASE_TYPE=postgres
```

### 4. Create the Database

#### Option A: Using psql command line
```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Create database
CREATE DATABASE flowise;

# Exit psql
\q
```

#### Option B: Using pgAdmin or other GUI tools
1. Connect to your PostgreSQL server
2. Create a new database named `flowise`

### 5. Run the Setup Script

```bash
# Run the SQL setup script
psql -U postgres -h localhost -d flowise -f postgresql-setup.sql
```

### 6. Test the Configuration

```bash
# Test database connection and setup
node postgres-config.js
```

## 🏗️ Database Schema

### Core Application Tables

#### `chat_flow`
Stores chatbot flow configurations
- `id` (UUID, Primary Key)
- `name` (VARCHAR, NOT NULL)
- `flowData` (TEXT) - JSON flow configuration
- `deployed` (BOOLEAN)
- `isPublic` (BOOLEAN)
- `chatbotConfig`, `apiConfig`, `analytic` (TEXT)
- `workspaceId` (VARCHAR) - Links to workspace

#### `chat_message`
Stores chat conversation messages
- `id` (UUID, Primary Key)
- `role` (VARCHAR, NOT NULL) - 'user', 'assistant', 'system'
- `chatflowid` (VARCHAR, NOT NULL)
- `content` (TEXT) - Message content
- `sourceDocuments`, `usedTools`, `artifacts` (TEXT) - JSON data
- `sessionId`, `chatId` (VARCHAR)

#### `credential`
Stores encrypted API credentials
- `id` (UUID, Primary Key)
- `name`, `credentialName` (VARCHAR, NOT NULL)
- `encryptedData` (TEXT) - Encrypted credential data
- `workspaceId` (VARCHAR)

### User Management Tables

#### `user`
Main user entity
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100), NOT NULL)
- `email` (VARCHAR(255), NOT NULL, UNIQUE)
- `credential` (TEXT) - Encrypted password
- `tempToken`, `tokenExpiry` - Password reset tokens
- `status` (VARCHAR(20)) - 'ACTIVE', 'INACTIVE', 'UNVERIFIED'

#### `organization`
Multi-tenant organization support
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100), NOT NULL)
- `customerId`, `subscriptionId` (VARCHAR(100)) - Billing integration

#### `workspace`
Workspace within organizations
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100), NOT NULL)
- `description` (TEXT)
- `organizationId` (UUID, NOT NULL) - Foreign key to organization

#### `role`
Role-based access control
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100), NOT NULL)
- `description` (TEXT)
- `permissions` (TEXT) - JSON array of permissions
- `organizationId` (UUID) - Organization-specific roles

### Relationship Tables

#### `organization_user`
Many-to-many: Users ↔ Organizations
- `organizationId`, `userId` (Composite Primary Key)
- `roleId` (UUID) - User's role in organization
- `status` (VARCHAR(20)) - 'ACTIVE', 'INACTIVE'

#### `workspace_user`
Many-to-many: Users ↔ Workspaces
- `workspaceId`, `userId` (Composite Primary Key)
- `roleId` (UUID) - User's role in workspace
- `status` (VARCHAR(20)) - 'ACTIVE', 'INACTIVE'

## 🔧 Configuration Integration

### Update Flowise Configuration

1. **Update DataSource Configuration**
   
   In your `packages/server/src/DataSource.ts`, ensure PostgreSQL is configured:
   
   ```typescript
   const postgresConfig = {
       name: 'postgres',
       type: 'postgres',
       host: process.env.POSTGRES_HOST || 'localhost',
       port: parseInt(process.env.POSTGRES_PORT) || 5432,
       username: process.env.POSTGRES_USER || 'postgres',
       password: process.env.POSTGRES_PASSWORD || 'password',
       database: process.env.POSTGRES_DB || 'flowise',
       synchronize: false, // Use migrations instead
       entities: [...entities],
       migrations: [...postgresMigrations],
       ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
   }
   ```

2. **Environment Variables**
   
   Set `DATABASE_TYPE=postgres` in your environment

### User Management Integration

#### Creating Users

```javascript
const { DatabaseUtils } = require('./postgres-config');

// Create a new user
const newUser = await DatabaseUtils.createUser({
    name: 'John Doe',
    email: 'john@example.com',
    status: 'ACTIVE',
    createdBy: adminUserId
});
```

#### User Authentication

```javascript
// Find user by email
const user = await DatabaseUtils.getUserByEmail('john@example.com');

if (user && user.status === 'ACTIVE') {
    // Proceed with authentication
    console.log('User found:', user.name);
}
```

## 🌐 Cloud Deployment

### Render.com Setup

1. **Create PostgreSQL Database**
   - Go to Render Dashboard
   - Create new PostgreSQL database
   - Note the connection details

2. **Update Environment Variables**
   ```env
   POSTGRES_HOST=your-postgres-host.render.com
   POSTGRES_PORT=5432
   POSTGRES_DB=your_database_name
   POSTGRES_USER=your_username
   POSTGRES_PASSWORD=your_password
   DATABASE_TYPE=postgres
   ```

3. **Run Migration**
   ```bash
   # Connect to Render PostgreSQL and run setup
   psql postgresql://username:password@host:port/database -f postgresql-setup.sql
   ```

### Other Cloud Providers

#### AWS RDS
```env
POSTGRES_HOST=your-rds-endpoint.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DB=flowise
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
```

#### Google Cloud SQL
```env
POSTGRES_HOST=your-cloud-sql-ip
POSTGRES_PORT=5432
POSTGRES_DB=flowise
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
```

#### Heroku Postgres
```env
# Heroku provides DATABASE_URL
DATABASE_URL=postgresql://username:password@host:port/database
```

## 🔍 Testing and Validation

### Health Check Script

```bash
# Run comprehensive health check
node postgres-config.js
```

This will:
- Test database connection
- Verify all tables exist
- Count users in database
- Display configuration status

### Manual Testing

```sql
-- Check user table
SELECT COUNT(*) FROM "user";

-- Check organizations
SELECT * FROM "organization";

-- Check user-organization relationships
SELECT 
    u."name", u."email", 
    o."name" as organization,
    r."name" as role
FROM "user" u
JOIN "organization_user" ou ON u."id" = ou."userId"
JOIN "organization" o ON ou."organizationId" = o."id"
JOIN "role" r ON ou."roleId" = r."id";
```

## 🛠️ Maintenance

### Backup

```bash
# Create backup
pg_dump -U postgres -h localhost flowise > flowise_backup.sql

# Restore backup
psql -U postgres -h localhost -d flowise < flowise_backup.sql
```

### Performance Monitoring

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check PostgreSQL is running
   - Verify host and port settings
   - Check firewall settings

2. **Authentication Failed**
   - Verify username and password
   - Check pg_hba.conf configuration

3. **SSL Connection Issues**
   - For production, ensure SSL is properly configured
   - For development, you can disable SSL

4. **Migration Errors**
   - Ensure database is empty before running setup
   - Check for existing tables with same names
   - Verify user has CREATE permissions

### Debug Commands

```bash
# Test connection
psql -U postgres -h localhost -d flowise -c "SELECT version();"

# List all tables
psql -U postgres -h localhost -d flowise -c "\dt"

# Check user table structure
psql -U postgres -h localhost -d flowise -c "\d user"
```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Library](https://node-postgres.com/)
- [TypeORM PostgreSQL Guide](https://typeorm.io/data-source-options#postgres--cockroachdb-data-source-options)
- [Render PostgreSQL Guide](https://render.com/docs/databases)

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your environment variables
3. Test database connectivity
4. Check application logs for detailed error messages

---

**Note**: Remember to update the default admin email (`admin@yourdomain.com`) in the setup script to match your actual admin email address.