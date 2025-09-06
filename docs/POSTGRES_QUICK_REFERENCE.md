# PostgreSQL Quick Reference for Flowise

A handy reference card for common PostgreSQL operations with your Flowise project.

## 🚀 Quick Start Commands

### Database Connection
```bash
# Connect to PostgreSQL
psql -U postgres -h localhost -d flowise

# Connect with environment variables
psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

# Test connection from Node.js
node postgres-config.js
```

### Essential psql Commands
```sql
-- List all databases
\l

-- Connect to flowise database
\c flowise

-- List all tables
\dt

-- Show table structure
\d "user"
\d chat_flow
\d chat_message

-- List indexes
\di

-- Show current connection
\conninfo

-- Exit
\q
```

## 📊 Flowise-Specific Queries

### User Management
```sql
-- Count total users
SELECT COUNT(*) FROM "user";

-- List all users with their status
SELECT id, name, email, status, "createdDate" 
FROM "user" 
ORDER BY "createdDate" DESC;

-- Find user by email
SELECT * FROM "user" WHERE email = 'admin@flowise.ai';

-- Check user organizations
SELECT u.name, u.email, o.name as organization
FROM "user" u
JOIN organization_user ou ON u.id = ou.user_id
JOIN organization o ON ou.organization_id = o.id;
```

### Chat Flow Analytics
```sql
-- Count chat flows by workspace
SELECT w.name as workspace, COUNT(cf.id) as flow_count
FROM chat_flow cf
JOIN workspace w ON cf."workspaceId" = w.id
GROUP BY w.name;

-- Most active chat flows (by message count)
SELECT cf.name, COUNT(cm.id) as message_count
FROM chat_flow cf
LEFT JOIN chat_message cm ON cf.id = cm.chatflowid
GROUP BY cf.id, cf.name
ORDER BY message_count DESC
LIMIT 10;

-- Recent chat activity
SELECT cf.name, cm.role, cm.content, cm."createdDate"
FROM chat_message cm
JOIN chat_flow cf ON cm.chatflowid = cf.id
ORDER BY cm."createdDate" DESC
LIMIT 20;
```

### System Health Checks
```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('flowise')) as database_size;

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Active connections
SELECT count(*) as active_connections FROM pg_stat_activity;

-- Long running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

## 🔧 Maintenance Commands

### Backup & Restore
```bash
# Create backup
pg_dump -U postgres -h localhost flowise > flowise_backup_$(date +%Y%m%d_%H%M%S).sql

# Create compressed backup
pg_dump -U postgres -h localhost flowise | gzip > flowise_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore from backup
psql -U postgres -h localhost -d flowise < flowise_backup_20240115_143022.sql

# Restore from compressed backup
gunzip -c flowise_backup_20240115_143022.sql.gz | psql -U postgres -h localhost -d flowise
```

### Performance Optimization
```sql
-- Analyze tables for better query planning
ANALYZE;

-- Vacuum to reclaim space
VACUUM;

-- Full vacuum (more thorough, locks tables)
VACUUM FULL;

-- Reindex all tables
REINDEX DATABASE flowise;

-- Update table statistics
ANALYZE VERBOSE;
```

### Index Management
```sql
-- Create index on frequently queried columns
CREATE INDEX CONCURRENTLY idx_chat_message_session 
ON chat_message ("sessionId");

CREATE INDEX CONCURRENTLY idx_chat_message_created 
ON chat_message ("createdDate");

CREATE INDEX CONCURRENTLY idx_user_email 
ON "user" (email);

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;

-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

## 🔒 Security & User Management

### User Operations
```sql
-- Create application user
CREATE USER flowise_app WITH PASSWORD 'secure_password';

-- Grant permissions
GRANT CONNECT ON DATABASE flowise TO flowise_app;
GRANT USAGE ON SCHEMA public TO flowise_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flowise_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flowise_app;

-- Change user password
ALTER USER flowise_app PASSWORD 'new_secure_password';

-- List all users and their permissions
\du

-- Revoke permissions
REVOKE ALL ON DATABASE flowise FROM flowise_app;

-- Drop user
DROP USER flowise_app;
```

### Connection Monitoring
```sql
-- Current connections
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity
WHERE datname = 'flowise';

-- Kill a connection
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE pid = 12345;
```

## 📈 Performance Monitoring

### Query Performance
```sql
-- Enable query statistics (run once)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Most frequently executed queries
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

### System Resources
```sql
-- Cache hit ratio (should be > 95%)
SELECT 
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
FROM pg_statio_user_tables;

-- Index usage ratio
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    idx_scan / (seq_scan + idx_scan + 1) * 100 as index_usage_ratio
FROM pg_stat_user_tables
ORDER BY index_usage_ratio DESC;
```

## 🛠️ Troubleshooting

### Common Issues
```sql
-- Check for locks
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Check for deadlocks in logs
SHOW log_destination;
SHOW log_directory;
SHOW log_filename;

-- Check configuration
SHOW all;
SHOW shared_buffers;
SHOW max_connections;
SHOW work_mem;
```

### Log Analysis
```bash
# Find PostgreSQL log files
# Linux
sudo find /var/log -name "postgresql*" -type f

# Check recent errors
sudo tail -f /var/log/postgresql/postgresql-15-main.log | grep ERROR

# Windows (check Event Viewer or)
dir "C:\Program Files\PostgreSQL\15\data\log"
```

## 🔄 Migration & Data Management

### Data Import/Export
```bash
# Export specific table
pg_dump -U postgres -h localhost -d flowise -t chat_message > chat_messages.sql

# Export data only (no schema)
pg_dump -U postgres -h localhost -d flowise --data-only > data_only.sql

# Export schema only
pg_dump -U postgres -h localhost -d flowise --schema-only > schema_only.sql

# Import CSV data
psql -U postgres -h localhost -d flowise -c "\copy chat_message FROM 'messages.csv' WITH CSV HEADER;"
```

### Schema Changes
```sql
-- Add column
ALTER TABLE chat_message ADD COLUMN new_field TEXT;

-- Modify column
ALTER TABLE chat_message ALTER COLUMN content TYPE TEXT;

-- Add index
CREATE INDEX CONCURRENTLY idx_new_field ON chat_message (new_field);

-- Add foreign key
ALTER TABLE chat_message 
ADD CONSTRAINT fk_chat_message_user 
FOREIGN KEY (user_id) REFERENCES "user"(id);
```

## 📱 Environment Variables Reference

```env
# Database Connection
DATABASE_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=flowise
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# SSL Configuration
POSTGRES_SSL=true
POSTGRES_SSL_MODE=require

# Connection Pool
POSTGRES_MAX_CONNECTIONS=20
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=2000

# Application Settings
NODE_ENV=production
FLOWISE_USERNAME=admin
FLOWISE_PASSWORD=admin_password
FLOWISE_SECRETKEY_OVERWRITE=your_secret_key
```

## 🚀 Quick Setup Scripts

### Test Connection
```bash
#!/bin/bash
# test-connection.sh
psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB" -c "SELECT 'Connection successful!' as status, version();"
```

### Daily Backup
```bash
#!/bin/bash
# daily-backup.sh
BACKUP_DIR="/backups/flowise"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U postgres -h localhost flowise | gzip > "$BACKUP_DIR/flowise_$DATE.sql.gz"
echo "Backup completed: flowise_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "flowise_*.sql.gz" -mtime +7 -delete
```

### Health Check
```bash
#!/bin/bash
# health-check.sh
echo "Checking PostgreSQL health..."
psql -U postgres -h localhost -d flowise -c "SELECT 'Database OK' as status;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL connection failed"
    exit 1
fi
```

---

**💡 Pro Tips:**
- Use `\timing on` in psql to see query execution times
- Use `EXPLAIN ANALYZE` to understand query performance
- Regular `VACUUM` and `ANALYZE` keep your database healthy
- Monitor your connection pool usage
- Always backup before major changes
- Use transactions for data consistency

**🔗 Quick Links:**
- [Full Installation Guide](./POSTGRESQL_INSTALLATION_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Setup Documentation](./POSTGRESQL_SETUP.md)