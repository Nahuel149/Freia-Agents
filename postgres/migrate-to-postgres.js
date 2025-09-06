/**
 * Database Migration Script: SQLite/MySQL to PostgreSQL
 * This script helps migrate existing data to the new PostgreSQL setup
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection
const pgPool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'flowise',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class DatabaseMigrator {
    constructor() {
        this.sourceDbPath = process.env.SOURCE_DB_PATH || './database.sqlite';
        this.migrationLog = [];
    }

    /**
     * Log migration steps
     */
    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        
        console.log(logEntry);
        this.migrationLog.push(logEntry);
    }

    /**
     * Test PostgreSQL connection
     */
    async testPostgresConnection() {
        try {
            const client = await pgPool.connect();
            const result = await client.query('SELECT version()');
            client.release();
            
            this.log('✅ PostgreSQL connection successful');
            this.log(`Database version: ${result.rows[0].version}`);
            return true;
        } catch (error) {
            this.log(`❌ PostgreSQL connection failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Check if source database exists
     */
    checkSourceDatabase() {
        if (fs.existsSync(this.sourceDbPath)) {
            this.log(`✅ Source database found: ${this.sourceDbPath}`);
            return true;
        } else {
            this.log(`❌ Source database not found: ${this.sourceDbPath}`, 'error');
            this.log('Please set SOURCE_DB_PATH environment variable to your database file', 'info');
            return false;
        }
    }

    /**
     * Create admin user in PostgreSQL
     */
    async createAdminUser(userData) {
        const { name, email, password } = userData;
        
        try {
            const client = await pgPool.connect();
            
            // Check if user already exists
            const existingUser = await client.query(
                'SELECT id FROM "user" WHERE email = $1',
                [email]
            );
            
            if (existingUser.rows.length > 0) {
                this.log(`User ${email} already exists, skipping creation`);
                client.release();
                return existingUser.rows[0].id;
            }
            
            // Create new user
            const result = await client.query(
                `INSERT INTO "user" ("name", "email", "credential", "status") 
                 VALUES ($1, $2, $3, 'ACTIVE') 
                 ON CONFLICT ("email") DO UPDATE SET "name" = $1
                 RETURNING "id"`,
                [name, email, password || null]
            );
            
            client.release();
            
            const userId = result.rows[0].id;
            this.log(`✅ Admin user created: ${name} (${email})`);
            return userId;
        } catch (error) {
            this.log(`❌ Error creating admin user: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Migrate chat flows (if they exist in source)
     */
    async migrateChatFlows(flows = []) {
        if (!flows || flows.length === 0) {
            this.log('No chat flows to migrate');
            return;
        }

        try {
            const client = await pgPool.connect();
            let migratedCount = 0;

            for (const flow of flows) {
                try {
                    await client.query(
                        `INSERT INTO "chat_flow" 
                         ("id", "name", "flowData", "deployed", "isPublic", "createdDate", "updatedDate") 
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT ("id") DO NOTHING`,
                        [
                            flow.id || require('crypto').randomUUID(),
                            flow.name || 'Migrated Flow',
                            flow.flowData || '{}',
                            flow.deployed || false,
                            flow.isPublic || false,
                            flow.createdDate || new Date(),
                            flow.updatedDate || new Date()
                        ]
                    );
                    migratedCount++;
                } catch (flowError) {
                    this.log(`❌ Error migrating flow ${flow.name}: ${flowError.message}`, 'error');
                }
            }

            client.release();
            this.log(`✅ Migrated ${migratedCount} chat flows`);
        } catch (error) {
            this.log(`❌ Error migrating chat flows: ${error.message}`, 'error');
        }
    }

    /**
     * Migrate credentials (if they exist in source)
     */
    async migrateCredentials(credentials = []) {
        if (!credentials || credentials.length === 0) {
            this.log('No credentials to migrate');
            return;
        }

        try {
            const client = await pgPool.connect();
            let migratedCount = 0;

            for (const cred of credentials) {
                try {
                    await client.query(
                        `INSERT INTO "credential" 
                         ("id", "name", "credentialName", "encryptedData", "createdDate", "updatedDate") 
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT ("id") DO NOTHING`,
                        [
                            cred.id || require('crypto').randomUUID(),
                            cred.name || 'Migrated Credential',
                            cred.credentialName || 'unknown',
                            cred.encryptedData || '{}',
                            cred.createdDate || new Date(),
                            cred.updatedDate || new Date()
                        ]
                    );
                    migratedCount++;
                } catch (credError) {
                    this.log(`❌ Error migrating credential ${cred.name}: ${credError.message}`, 'error');
                }
            }

            client.release();
            this.log(`✅ Migrated ${migratedCount} credentials`);
        } catch (error) {
            this.log(`❌ Error migrating credentials: ${error.message}`, 'error');
        }
    }

    /**
     * Setup default organization and workspace
     */
    async setupDefaultOrgAndWorkspace(adminUserId) {
        try {
            const client = await pgPool.connect();

            // Create default organization
            const orgResult = await client.query(
                `INSERT INTO "organization" ("name", "createdBy", "updatedBy") 
                 VALUES ('Default Organization', $1, $1) 
                 ON CONFLICT DO NOTHING
                 RETURNING "id"`,
                [adminUserId]
            );

            let orgId;
            if (orgResult.rows.length > 0) {
                orgId = orgResult.rows[0].id;
            } else {
                // Get existing organization
                const existingOrg = await client.query(
                    'SELECT "id" FROM "organization" WHERE "name" = \'Default Organization\' LIMIT 1'
                );
                orgId = existingOrg.rows[0].id;
            }

            // Create admin role
            const roleResult = await client.query(
                `INSERT INTO "role" ("organizationId", "name", "description", "permissions", "createdBy", "updatedBy") 
                 VALUES ($1, 'Admin', 'Administrator role', '["read", "write", "delete", "admin"]', $2, $2) 
                 ON CONFLICT DO NOTHING
                 RETURNING "id"`,
                [orgId, adminUserId]
            );

            let roleId;
            if (roleResult.rows.length > 0) {
                roleId = roleResult.rows[0].id;
            } else {
                // Get existing role
                const existingRole = await client.query(
                    'SELECT "id" FROM "role" WHERE "name" = \'Admin\' AND "organizationId" = $1 LIMIT 1',
                    [orgId]
                );
                roleId = existingRole.rows[0].id;
            }

            // Create default workspace
            const workspaceResult = await client.query(
                `INSERT INTO "workspace" ("name", "description", "organizationId", "createdBy", "updatedBy") 
                 VALUES ('Default Workspace', 'Default workspace for the organization', $1, $2, $2) 
                 ON CONFLICT DO NOTHING
                 RETURNING "id"`,
                [orgId, adminUserId]
            );

            let workspaceId;
            if (workspaceResult.rows.length > 0) {
                workspaceId = workspaceResult.rows[0].id;
            } else {
                // Get existing workspace
                const existingWorkspace = await client.query(
                    'SELECT "id" FROM "workspace" WHERE "name" = \'Default Workspace\' AND "organizationId" = $1 LIMIT 1',
                    [orgId]
                );
                workspaceId = existingWorkspace.rows[0].id;
            }

            // Link admin user to organization
            await client.query(
                `INSERT INTO "organization_user" ("organizationId", "userId", "roleId", "createdBy", "updatedBy") 
                 VALUES ($1, $2, $3, $2, $2) 
                 ON CONFLICT DO NOTHING`,
                [orgId, adminUserId, roleId]
            );

            // Link admin user to workspace
            await client.query(
                `INSERT INTO "workspace_user" ("workspaceId", "userId", "roleId", "createdBy", "updatedBy") 
                 VALUES ($1, $2, $3, $2, $2) 
                 ON CONFLICT DO NOTHING`,
                [workspaceId, adminUserId, roleId]
            );

            client.release();
            this.log('✅ Default organization and workspace setup completed');
            
            return { orgId, workspaceId, roleId };
        } catch (error) {
            this.log(`❌ Error setting up organization and workspace: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Generate migration report
     */
    generateReport() {
        const reportPath = path.join(__dirname, 'migration-report.txt');
        const reportContent = [
            '='.repeat(60),
            'DATABASE MIGRATION REPORT',
            '='.repeat(60),
            `Migration Date: ${new Date().toISOString()}`,
            `Source Database: ${this.sourceDbPath}`,
            `Target Database: PostgreSQL`,
            '',
            'MIGRATION LOG:',
            '-'.repeat(40),
            ...this.migrationLog,
            '',
            '='.repeat(60)
        ].join('\n');

        fs.writeFileSync(reportPath, reportContent);
        this.log(`📄 Migration report saved to: ${reportPath}`);
    }

    /**
     * Run complete migration
     */
    async runMigration(options = {}) {
        const {
            adminUser = {
                name: 'Admin User',
                email: 'admin@yourdomain.com',
                password: null
            },
            chatFlows = [],
            credentials = []
        } = options;

        this.log('🚀 Starting database migration to PostgreSQL');
        this.log('='.repeat(50));

        try {
            // Step 1: Test connections
            this.log('Step 1: Testing database connections...');
            const pgConnected = await this.testPostgresConnection();
            if (!pgConnected) {
                throw new Error('PostgreSQL connection failed');
            }

            // Step 2: Create admin user
            this.log('Step 2: Creating admin user...');
            const adminUserId = await this.createAdminUser(adminUser);

            // Step 3: Setup organization and workspace
            this.log('Step 3: Setting up organization and workspace...');
            await this.setupDefaultOrgAndWorkspace(adminUserId);

            // Step 4: Migrate data
            this.log('Step 4: Migrating application data...');
            await this.migrateChatFlows(chatFlows);
            await this.migrateCredentials(credentials);

            // Step 5: Generate report
            this.log('Step 5: Generating migration report...');
            this.generateReport();

            this.log('='.repeat(50));
            this.log('✅ Migration completed successfully!');
            this.log('Next steps:');
            this.log('1. Update your application environment variables');
            this.log('2. Set DATABASE_TYPE=postgres');
            this.log('3. Test your application with the new database');
            this.log('4. Review the migration report for any issues');

        } catch (error) {
            this.log(`❌ Migration failed: ${error.message}`, 'error');
            this.generateReport();
            throw error;
        } finally {
            await pgPool.end();
        }
    }
}

// Example usage and CLI interface
if (require.main === module) {
    const migrator = new DatabaseMigrator();

    // Example migration with sample data
    const migrationOptions = {
        adminUser: {
            name: process.env.ADMIN_NAME || 'Admin User',
            email: process.env.ADMIN_EMAIL || 'admin@yourdomain.com',
            password: process.env.ADMIN_PASSWORD || null
        },
        // Add your existing data here
        chatFlows: [
            // Example:
            // {
            //     id: 'flow-1',
            //     name: 'My Chat Flow',
            //     flowData: '{}',
            //     deployed: true,
            //     isPublic: false
            // }
        ],
        credentials: [
            // Example:
            // {
            //     id: 'cred-1',
            //     name: 'OpenAI API',
            //     credentialName: 'openAIApi',
            //     encryptedData: '{}'
            // }
        ]
    };

    migrator.runMigration(migrationOptions)
        .then(() => {
            console.log('\n🎉 Migration process completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Migration process failed:', error.message);
            process.exit(1);
        });
}

module.exports = DatabaseMigrator;