# PostgreSQL Installation Guide for Flowise

This guide will help you install PostgreSQL and choose the best version for your Flowise project.

## 🎯 Recommended PostgreSQL Version

**For Flowise Project: PostgreSQL 15.x or 16.x**

### Why These Versions?

- **PostgreSQL 15.x**: Stable, well-tested, excellent performance
- **PostgreSQL 16.x**: Latest stable with enhanced features
- **Minimum Required**: PostgreSQL 12.x (for compatibility)
- **Avoid**: PostgreSQL 17.x (too new, potential compatibility issues)

### Version Compatibility Matrix

| PostgreSQL Version | Flowise Compatibility | Recommendation |
|-------------------|----------------------|----------------|
| 12.x              | ✅ Compatible        | Minimum        |
| 13.x              | ✅ Compatible        | Good           |
| 14.x              | ✅ Compatible        | Good           |
| **15.x**          | ✅ **Recommended**   | **Best**       |
| **16.x**          | ✅ **Recommended**   | **Best**       |
| 17.x              | ⚠️ Untested          | Not Recommended|

## 🖥️ Installation by Operating System

### Windows Installation

#### Method 1: Official Installer (Recommended)

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15.x or 16.x installer
   - Choose the appropriate architecture (x64 for most systems)

2. **Run the Installer**
   ```
   - Run the downloaded .exe file as Administrator
   - Follow the installation wizard
   - Set a strong password for the 'postgres' user
   - Default port: 5432 (recommended)
   - Install pgAdmin 4 (database management tool)
   ```

3. **Verify Installation**
   ```cmd
   # Open Command Prompt and test
   psql --version
   
   # Connect to PostgreSQL
   psql -U postgres -h localhost
   ```

#### Method 2: Using Chocolatey

```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install PostgreSQL
choco install postgresql15 --params '/Password:YourStrongPassword'

# Or for version 16
choco install postgresql16 --params '/Password:YourStrongPassword'
```

#### Method 3: Using Scoop

```powershell
# Install Scoop first (if not installed)
iwr -useb get.scoop.sh | iex

# Install PostgreSQL
scoop bucket add main
scoop install postgresql
```

### macOS Installation

#### Method 1: Using Homebrew (Recommended)

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL 15
brew install postgresql@15

# Or install PostgreSQL 16
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@15
# or
brew services start postgresql@16

# Create a database user
createuser -s postgres
```

#### Method 2: Postgres.app

1. Download from: https://postgresapp.com/
2. Drag Postgres.app to Applications folder
3. Launch the app and click "Initialize"
4. Add to PATH:
   ```bash
   echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

#### Method 3: Official Installer

1. Download from: https://www.postgresql.org/download/macosx/
2. Run the installer and follow the wizard
3. Set password for postgres user

### Linux Installation

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install PostgreSQL 15
sudo apt install postgresql-15 postgresql-client-15 postgresql-contrib-15

# Or install PostgreSQL 16
sudo apt install postgresql-16 postgresql-client-16 postgresql-contrib-16

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Set password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your_password';"
```

#### CentOS/RHEL/Rocky Linux

```bash
# Install PostgreSQL repository
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Install PostgreSQL 15
sudo dnf install -y postgresql15-server postgresql15

# Initialize database
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb

# Start and enable service
sudo systemctl enable postgresql-15
sudo systemctl start postgresql-15
```

#### Arch Linux

```bash
# Install PostgreSQL
sudo pacman -S postgresql

# Initialize database cluster
sudo -u postgres initdb -D /var/lib/postgres/data

# Start and enable service
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 🔧 Post-Installation Configuration

### 1. Create Flowise Database

```sql
-- Connect as postgres user
psql -U postgres -h localhost

-- Create database
CREATE DATABASE flowise;

-- Create dedicated user (optional but recommended)
CREATE USER flowise_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE flowise TO flowise_user;

-- Exit
\q
```

### 2. Configure PostgreSQL for Flowise

#### Edit postgresql.conf

```bash
# Find config file location
psql -U postgres -c "SHOW config_file;"

# Edit the file (location varies by OS)
# Common locations:
# Windows: C:\Program Files\PostgreSQL\15\data\postgresql.conf
# macOS: /usr/local/var/postgres/postgresql.conf
# Linux: /etc/postgresql/15/main/postgresql.conf
```

**Recommended Settings for Flowise:**

```ini
# Connection settings
listen_addresses = 'localhost'          # or '*' for remote connections
port = 5432
max_connections = 100

# Memory settings
shared_buffers = 256MB                  # 25% of RAM for dedicated server
effective_cache_size = 1GB              # 75% of RAM
work_mem = 4MB
maintenance_work_mem = 64MB

# Logging
log_statement = 'none'                  # or 'all' for debugging
log_min_duration_statement = 1000       # Log slow queries (1 second)

# Performance
random_page_cost = 1.1                  # For SSD storage
effective_io_concurrency = 200          # For SSD storage
```

#### Edit pg_hba.conf (Authentication)

```bash
# Find pg_hba.conf location
psql -U postgres -c "SHOW hba_file;"
```

**Add these lines for local development:**

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

### 3. Restart PostgreSQL

```bash
# Windows (as Administrator)
net stop postgresql-x64-15
net start postgresql-x64-15

# macOS (Homebrew)
brew services restart postgresql@15

# Linux (systemd)
sudo systemctl restart postgresql
```

## 🚀 Initialize Flowise Database Schema

### Using the Provided Setup Script

```bash
# Navigate to your Flowise project directory
cd c:\Users\nahue\Desktop\Freia

# Run the PostgreSQL setup script
psql -U postgres -h localhost -d flowise -f postgresql-setup.sql

# Verify the setup
node validate-postgres-setup.js
```

### Manual Schema Setup

```sql
-- Connect to flowise database
psql -U postgres -h localhost -d flowise

-- Check if tables were created
\dt

-- Verify user table structure
\d "user"

-- Check for sample data
SELECT * FROM "user" LIMIT 5;
```

## 🔍 Verification and Testing

### 1. Test Connection

```bash
# Test basic connection
psql -U postgres -h localhost -d flowise -c "SELECT version();"

# Test with Flowise config
node postgres-config.js
```

### 2. Performance Test

```sql
-- Connect to database
psql -U postgres -h localhost -d flowise

-- Test query performance
\timing on
SELECT COUNT(*) FROM chat_message;
SELECT COUNT(*) FROM "user";
```

### 3. Validate Complete Setup

```bash
# Run comprehensive validation
node validate-postgres-setup.js

# Expected output: All checks should pass
# 🎉 Your PostgreSQL setup is ready for production!
```

## 🛠️ Development Tools

### Recommended PostgreSQL Tools

1. **pgAdmin 4** (Web-based GUI)
   - Usually installed with PostgreSQL
   - Access: http://localhost:5050 (or desktop app)

2. **DBeaver** (Universal database tool)
   - Download: https://dbeaver.io/
   - Free, cross-platform

3. **TablePlus** (macOS/Windows)
   - Download: https://tableplus.com/
   - Clean, modern interface

4. **psql** (Command-line interface)
   - Included with PostgreSQL
   - Most powerful for scripting

### Useful psql Commands

```sql
-- List databases
\l

-- Connect to database
\c flowise

-- List tables
\dt

-- Describe table structure
\d table_name

-- List users
\du

-- Show current connection info
\conninfo

-- Exit
\q
```

## 🔒 Security Best Practices

### 1. User Management

```sql
-- Create application-specific user
CREATE USER flowise_app WITH PASSWORD 'strong_random_password';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE flowise TO flowise_app;
GRANT USAGE ON SCHEMA public TO flowise_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flowise_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flowise_app;
```

### 2. Connection Security

```ini
# In postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

### 3. Environment Variables

```env
# Use strong passwords
POSTGRES_PASSWORD=your_very_strong_password_here

# Enable SSL in production
POSTGRES_SSL=true
POSTGRES_SSL_MODE=require
```

## 🚨 Troubleshooting

### Common Issues

#### Connection Refused
```bash
# Check if PostgreSQL is running
# Windows
sc query postgresql-x64-15

# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

#### Permission Denied
```sql
-- Reset user password
ALTER USER postgres PASSWORD 'new_password';

-- Check user permissions
\du
```

#### Port Already in Use
```bash
# Find process using port 5432
# Windows
netstat -ano | findstr :5432

# macOS/Linux
lsof -i :5432
```

#### Database Does Not Exist
```sql
-- List all databases
\l

-- Create missing database
CREATE DATABASE flowise;
```

### Performance Issues

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

## 📚 Next Steps

1. **Configure Flowise**: Update your Flowise application to use PostgreSQL
2. **Environment Setup**: Configure environment variables
3. **Migration**: If migrating from SQLite, use the migration script
4. **Backup Strategy**: Set up regular database backups
5. **Monitoring**: Implement database monitoring

## 🔗 Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [PostgreSQL Security Guide](https://www.postgresql.org/docs/current/security.html)
- [Flowise Documentation](https://docs.flowiseai.com/)

---

**Congratulations!** You now have PostgreSQL installed and configured for your Flowise project. The recommended version (15.x or 16.x) will provide excellent performance and compatibility for your application.