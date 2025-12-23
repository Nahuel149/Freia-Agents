#!/usr/bin/env node

/**
 * Production Deployment Script for B2B Sales System
 * Deploys to Render PostgreSQL and sets up the complete system
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Production Configuration
const PRODUCTION_CONFIG = {
    // Render PostgreSQL Connection
    database: {
        host: 'dpg-d2u0qtmr433s73dresng-a.oregon-postgres.render.com', // External hostname
        port: 5432,
        database: 'freia_postgres',
        user: 'freia_postgres_user',
        // Password should be set via environment variable
        password: process.env.POSTGRES_PASSWORD
    },

    // Flowise Configuration
    flowise: {
        url: process.env.FLOWISE_URL || 'https://your-flowise-app.render.com',
        apiKey: process.env.FLOWISE_API_KEY
    }
}

class ProductionDeployer {
    constructor() {
        this.client = null
        this.log = (message, type = 'info') => {
            const timestamp = new Date().toISOString()
            const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'
            console.log(`${emoji} [${timestamp}] ${message}`)
        }
    }

    async connectToDatabase() {
        try {
            this.log('Connecting to Render PostgreSQL database...')

            // Check for required environment variables
            if (!process.env.POSTGRES_PASSWORD && !process.env.DATABASE_URL) {
                throw new Error('Missing database credentials. Set POSTGRES_PASSWORD or DATABASE_URL environment variable.')
            }

            // Try different connection methods
            let connectionConfig

            if (process.env.DATABASE_URL) {
                // Use DATABASE_URL if available
                this.log('Using DATABASE_URL for connection...')
                connectionConfig = {
                    connectionString: process.env.DATABASE_URL,
                    ssl: { rejectUnauthorized: false }
                }
            } else {
                // Use individual config
                this.log('Using individual database config...')
                connectionConfig = {
                    ...PRODUCTION_CONFIG.database,
                    ssl: { rejectUnauthorized: false }
                }
            }

            this.client = new Client(connectionConfig)
            await this.client.connect()

            // Test connection
            const result = await this.client.query('SELECT NOW()')
            this.log(`Database connected successfully at ${result.rows[0].now}`, 'success')

            return true
        } catch (error) {
            this.log(`Database connection failed: ${error.message}`, 'error')
            this.log('Please check your database credentials and network connectivity.', 'warning')
            this.log('Required: POSTGRES_PASSWORD or DATABASE_URL environment variable', 'warning')
            return false
        }
    }

    async createB2BSchema() {
        try {
            this.log('Creating B2B Sales schema...')

            // Define SQL commands in correct order
            const commands = [
                // Create tables
                `CREATE TABLE IF NOT EXISTS customers (
                    id SERIAL PRIMARY KEY,
                    phone_number VARCHAR(20) UNIQUE NOT NULL,
                    first_name VARCHAR(100),
                    last_name VARCHAR(100),
                    email VARCHAR(255),
                    default_address TEXT,
                    default_payment_method VARCHAR(50),
                    previous_purchases TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS sales (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES customers(id),
                    phone_number VARCHAR(20) NOT NULL,
                    product_sku VARCHAR(100) NOT NULL,
                    product_brand VARCHAR(100),
                    product_model VARCHAR(100),
                    wheel_size VARCHAR(50),
                    quantity INTEGER DEFAULT 1,
                    unit_price DECIMAL(10,2),
                    total_price DECIMAL(10,2),
                    discount_percentage DECIMAL(5,2) DEFAULT 0,
                    final_price DECIMAL(10,2),
                    payment_method VARCHAR(50),
                    delivery_method VARCHAR(50),
                    delivery_address TEXT,
                    sale_status VARCHAR(20) DEFAULT 'pending',
                    negotiation_attempts INTEGER DEFAULT 0,
                    agent_notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS follow_ups (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES customers(id),
                    phone_number VARCHAR(20) NOT NULL,
                    follow_up_type VARCHAR(50) NOT NULL,
                    scheduled_at TIMESTAMP NOT NULL,
                    completed_at TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'pending',
                    attempt_number INTEGER DEFAULT 1,
                    max_attempts INTEGER DEFAULT 3,
                    message_sent TEXT,
                    customer_response TEXT,
                    next_action VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,

                // Create indexes
                'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number)',
                'CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id)',
                'CREATE INDEX IF NOT EXISTS idx_sales_phone ON sales(phone_number)',
                'CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(sale_status)',
                'CREATE INDEX IF NOT EXISTS idx_followups_customer_id ON follow_ups(customer_id)',
                'CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON follow_ups(scheduled_at)',
                'CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups(status)',

                // Create function
                `CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql`,

                // Create triggers
                `DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
                CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

                `DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
                CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

                `DROP TRIGGER IF EXISTS update_followups_updated_at ON follow_ups;
                CREATE TRIGGER update_followups_updated_at BEFORE UPDATE ON follow_ups
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
            ]

            // Execute each command
            for (const command of commands) {
                try {
                    await this.client.query(command)
                    this.log(`Executed: ${command.substring(0, 50).replace(/\n/g, ' ')}...`)
                } catch (error) {
                    if (error.message.includes('already exists')) {
                        this.log(`Skipped (already exists): ${command.substring(0, 50).replace(/\n/g, ' ')}...`, 'warning')
                    } else {
                        throw error
                    }
                }
            }

            // Insert sample data
            const sampleData = [
                `INSERT INTO customers (phone_number, first_name, last_name, default_address, default_payment_method) 
                VALUES ('+5491123456789', 'Juan', 'Pérez', 'Av. Corrientes 1234, CABA', 'Transferencia')
                ON CONFLICT (phone_number) DO NOTHING`,

                `INSERT INTO customers (phone_number, first_name, last_name, default_address, default_payment_method) 
                VALUES ('+5491198765432', 'María', 'González', 'Av. Santa Fe 5678, CABA', 'Tarjeta')
                ON CONFLICT (phone_number) DO NOTHING`
            ]

            for (const data of sampleData) {
                try {
                    await this.client.query(data)
                    this.log(`Sample data inserted`)
                } catch (error) {
                    this.log(`Sample data already exists`, 'warning')
                }
            }

            this.log('B2B Sales schema created successfully!', 'success')
            return true
        } catch (error) {
            this.log(`Schema creation failed: ${error.message}`, 'error')
            return false
        }
    }

    async verifyTables() {
        try {
            this.log('Verifying B2B tables...')

            const tables = ['customers', 'sales', 'follow_ups']
            const results = {}

            for (const table of tables) {
                const result = await this.client.query(`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = $1`, [
                    table
                ])
                results[table] = result.rows[0].count > 0

                if (results[table]) {
                    const countResult = await this.client.query(`SELECT COUNT(*) as records FROM ${table}`)
                    this.log(`✅ Table '${table}' exists with ${countResult.rows[0].records} records`)
                } else {
                    this.log(`❌ Table '${table}' not found`, 'error')
                }
            }

            return Object.values(results).every((exists) => exists)
        } catch (error) {
            this.log(`Table verification failed: ${error.message}`, 'error')
            return false
        }
    }

    async setupEnvironmentVariables() {
        try {
            this.log('Setting up environment variables...')

            const envVars = {
                POSTGRES_HOST: PRODUCTION_CONFIG.database.host,
                POSTGRES_PORT: PRODUCTION_CONFIG.database.port.toString(),
                POSTGRES_DB: PRODUCTION_CONFIG.database.database,
                POSTGRES_USER: PRODUCTION_CONFIG.database.user,
                FLOWISE_URL: PRODUCTION_CONFIG.flowise.url,
                B2B_SYSTEM_ENABLED: 'true',
                NODE_ENV: 'production'
            }

            // Create .env.production file
            const envContent = Object.entries(envVars)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n')

            fs.writeFileSync('.env.production', envContent)
            this.log('Environment variables configured', 'success')

            return true
        } catch (error) {
            this.log(`Environment setup failed: ${error.message}`, 'error')
            return false
        }
    }

    async deployToProduction() {
        try {
            this.log('🚀 Starting Production Deployment...', 'success')

            // Step 1: Connect to database
            const connected = await this.connectToDatabase()
            if (!connected) {
                throw new Error('Database connection failed')
            }

            // Step 2: Create schema
            const schemaCreated = await this.createB2BSchema()
            if (!schemaCreated) {
                throw new Error('Schema creation failed')
            }

            // Step 3: Verify tables
            const tablesVerified = await this.verifyTables()
            if (!tablesVerified) {
                throw new Error('Table verification failed')
            }

            // Step 4: Setup environment
            const envSetup = await this.setupEnvironmentVariables()
            if (!envSetup) {
                throw new Error('Environment setup failed')
            }

            this.log('🎉 Production deployment completed successfully!', 'success')

            // Display next steps
            console.log('\n📋 Next Steps:')
            console.log('1. Import Flowise templates from flowise-templates.json')
            console.log('2. Configure WhatsApp webhook (if needed)')
            console.log('3. Test the system with a sample message')
            console.log('4. Monitor logs and performance')

            console.log('\n🔗 Production URLs:')
            console.log(`Database: ${PRODUCTION_CONFIG.database.host}`)
            console.log(`Flowise: ${PRODUCTION_CONFIG.flowise.url}`)

            console.log('\n📖 For detailed setup instructions, see:')
            console.log('production-setup-guide.md')

            return true
        } catch (error) {
            this.log(`Production deployment failed: ${error.message}`, 'error')
            return false
        } finally {
            if (this.client) {
                await this.client.end()
            }
        }
    }
}

// Main execution
if (require.main === module) {
    const deployer = new ProductionDeployer()

    deployer
        .deployToProduction()
        .then((success) => {
            process.exit(success ? 0 : 1)
        })
        .catch((error) => {
            console.error('❌ Deployment failed:', error)
            process.exit(1)
        })
}

module.exports = ProductionDeployer
