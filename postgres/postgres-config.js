/**
 * PostgreSQL Database Configuration for Flowise Application
 * This file provides database connection settings and utilities
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
    // Connection settings
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'flowise',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    
    // Connection pool settings
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 2000,
    
    // SSL configuration (important for production)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Set to true in production with proper certificates
    } : false
};

// Create connection pool
const pool = new Pool(dbConfig);

// Connection event handlers
pool.on('connect', (client) => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

// Database utility functions
class DatabaseUtils {
    /**
     * Test database connection
     */
    static async testConnection() {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
            client.release();
            
            console.log('🔗 Database connection successful!');
            console.log('📅 Current time:', result.rows[0].current_time);
            console.log('🐘 PostgreSQL version:', result.rows[0].postgres_version);
            
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }
    }

    /**
     * Check if required tables exist
     */
    static async checkTables() {
        const requiredTables = [
            'user', 'organization', 'role', 'workspace', 'login_method',
            'organization_user', 'workspace_user', 'chat_flow', 'chat_message',
            'credential', 'tool', 'api_key', 'assistant'
        ];

        try {
            const client = await pool.connect();
            
            for (const table of requiredTables) {
                const result = await client.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )`,
                    [table]
                );
                
                if (result.rows[0].exists) {
                    console.log(`✅ Table '${table}' exists`);
                } else {
                    console.log(`❌ Table '${table}' missing`);
                }
            }
            
            client.release();
        } catch (error) {
            console.error('❌ Error checking tables:', error.message);
        }
    }

    /**
     * Get user count
     */
    static async getUserCount() {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT COUNT(*) as user_count FROM "user"');
            client.release();
            
            const count = parseInt(result.rows[0].user_count);
            console.log(`👥 Total users in database: ${count}`);
            return count;
        } catch (error) {
            console.error('❌ Error getting user count:', error.message);
            return 0;
        }
    }

    /**
     * Create a new user
     */
    static async createUser(userData) {
        const { name, email, status = 'ACTIVE', createdBy } = userData;
        
        try {
            const client = await pool.connect();
            
            const result = await client.query(
                `INSERT INTO "user" ("name", "email", "status", "createdBy", "updatedBy") 
                 VALUES ($1, $2, $3, $4, $4) 
                 RETURNING "id", "name", "email", "status", "createdDate"`,
                [name, email, status, createdBy]
            );
            
            client.release();
            
            console.log('✅ User created successfully:', result.rows[0]);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Error creating user:', error.message);
            throw error;
        }
    }

    /**
     * Get user by email
     */
    static async getUserByEmail(email) {
        try {
            const client = await pool.connect();
            
            const result = await client.query(
                'SELECT * FROM "user" WHERE "email" = $1',
                [email]
            );
            
            client.release();
            
            if (result.rows.length > 0) {
                console.log('✅ User found:', result.rows[0].name);
                return result.rows[0];
            } else {
                console.log('❌ User not found with email:', email);
                return null;
            }
        } catch (error) {
            console.error('❌ Error getting user:', error.message);
            return null;
        }
    }

    /**
     * Get all users with their organizations and workspaces
     */
    static async getAllUsersWithDetails() {
        try {
            const client = await pool.connect();
            
            const result = await client.query(`
                SELECT 
                    u."id", u."name", u."email", u."status", u."createdDate",
                    o."name" as organization_name,
                    w."name" as workspace_name,
                    r."name" as role_name
                FROM "user" u
                LEFT JOIN "organization_user" ou ON u."id" = ou."userId"
                LEFT JOIN "organization" o ON ou."organizationId" = o."id"
                LEFT JOIN "workspace_user" wu ON u."id" = wu."userId"
                LEFT JOIN "workspace" w ON wu."workspaceId" = w."id"
                LEFT JOIN "role" r ON ou."roleId" = r."id"
                ORDER BY u."createdDate" DESC
            `);
            
            client.release();
            
            console.log(`📋 Found ${result.rows.length} user records`);
            return result.rows;
        } catch (error) {
            console.error('❌ Error getting users with details:', error.message);
            return [];
        }
    }

    /**
     * Run database health check
     */
    static async healthCheck() {
        console.log('🏥 Running database health check...');
        
        const isConnected = await this.testConnection();
        if (!isConnected) return false;
        
        await this.checkTables();
        await this.getUserCount();
        
        console.log('✅ Database health check completed');
        return true;
    }

    /**
     * Close database connection pool
     */
    static async close() {
        await pool.end();
        console.log('🔌 Database connection pool closed');
    }
}

// Environment variables template
const envTemplate = `
# PostgreSQL Database Configuration
# Copy these variables to your .env file and update with your values

# Database Connection
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=flowise
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here

# Connection Pool Settings
POSTGRES_MAX_CONNECTIONS=20
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=2000

# For Render.com or other cloud providers:
# POSTGRES_HOST=your-postgres-host.render.com
# POSTGRES_PORT=5432
# POSTGRES_DB=your_database_name
# POSTGRES_USER=your_username
# POSTGRES_PASSWORD=your_password

# Application Settings
NODE_ENV=production
DATABASE_TYPE=postgres
`;

// Export configuration and utilities
module.exports = {
    pool,
    dbConfig,
    DatabaseUtils,
    envTemplate
};

// If this file is run directly, perform health check
if (require.main === module) {
    (async () => {
        console.log('🚀 PostgreSQL Configuration Test');
        console.log('================================');
        
        await DatabaseUtils.healthCheck();
        
        // Show environment template
        console.log('\n📝 Environment Variables Template:');
        console.log(envTemplate);
        
        await DatabaseUtils.close();
    })();
}