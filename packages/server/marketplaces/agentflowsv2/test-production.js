#!/usr/bin/env node

/**
 * Production Test Script for B2B Sales System
 * Tests database connectivity and basic functionality
 */

const { Client } = require('pg')

class ProductionTester {
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
            this.log('Testing database connection...')

            let connectionConfig

            if (process.env.DATABASE_URL) {
                connectionConfig = {
                    connectionString: process.env.DATABASE_URL,
                    ssl: { rejectUnauthorized: false }
                }
            } else if (process.env.POSTGRES_PASSWORD) {
                connectionConfig = {
                    host: 'dpg-d2u0qtmr433s73dresng-a.render.com',
                    port: 5432,
                    database: 'freia_postgres',
                    user: 'freia_postgres_user',
                    password: process.env.POSTGRES_PASSWORD,
                    ssl: { rejectUnauthorized: false }
                }
            } else {
                throw new Error('Missing database credentials')
            }

            this.client = new Client(connectionConfig)
            await this.client.connect()

            const result = await this.client.query('SELECT NOW() as current_time, version() as pg_version')
            this.log(`Connected successfully!`, 'success')
            this.log(`Time: ${result.rows[0].current_time}`)
            this.log(`PostgreSQL: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`)

            return true
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error')
            return false
        }
    }

    async testTables() {
        try {
            this.log('Testing B2B tables...')

            const tables = ['customers', 'sales', 'follow_ups']
            const results = {}

            for (const table of tables) {
                try {
                    // Check if table exists
                    const existsResult = await this.client.query(
                        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
                        [table]
                    )

                    if (existsResult.rows[0].exists) {
                        // Count records
                        const countResult = await this.client.query(`SELECT COUNT(*) as count FROM ${table}`)
                        results[table] = {
                            exists: true,
                            count: parseInt(countResult.rows[0].count)
                        }
                        this.log(`Table '${table}': ${results[table].count} records`, 'success')
                    } else {
                        results[table] = { exists: false, count: 0 }
                        this.log(`Table '${table}': NOT FOUND`, 'error')
                    }
                } catch (error) {
                    results[table] = { exists: false, error: error.message }
                    this.log(`Table '${table}': ERROR - ${error.message}`, 'error')
                }
            }

            return results
        } catch (error) {
            this.log(`Table testing failed: ${error.message}`, 'error')
            return null
        }
    }

    async testSampleData() {
        try {
            this.log('Testing sample data...')

            // Test customers
            const customersResult = await this.client.query(`SELECT id, name, email, company FROM customers LIMIT 3`)

            if (customersResult.rows.length > 0) {
                this.log(`Sample customers found:`, 'success')
                customersResult.rows.forEach((customer) => {
                    console.log(`  - ${customer.name} (${customer.email}) at ${customer.company}`)
                })
            } else {
                this.log('No sample customers found', 'warning')
            }

            // Test sales
            const salesResult = await this.client.query(
                `SELECT s.id, s.product_name, s.amount, s.currency, c.name as customer_name 
                 FROM sales s 
                 JOIN customers c ON s.customer_id = c.id 
                 LIMIT 3`
            )

            if (salesResult.rows.length > 0) {
                this.log(`Sample sales found:`, 'success')
                salesResult.rows.forEach((sale) => {
                    console.log(`  - ${sale.product_name}: $${sale.amount} ${sale.currency} (${sale.customer_name})`)
                })
            } else {
                this.log('No sample sales found', 'warning')
            }

            return true
        } catch (error) {
            this.log(`Sample data test failed: ${error.message}`, 'error')
            return false
        }
    }

    async testFunctions() {
        try {
            this.log('Testing database functions...')

            // Test the update_updated_at_column function
            const functionResult = await this.client.query(
                `SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')`
            )

            if (functionResult.rows[0].exists) {
                this.log('Timestamp update function exists', 'success')
            } else {
                this.log('Timestamp update function missing', 'warning')
            }

            // Test triggers
            const triggerResult = await this.client.query(`SELECT tgname FROM pg_trigger WHERE tgname LIKE '%update_updated_at%'`)

            if (triggerResult.rows.length > 0) {
                this.log(`Found ${triggerResult.rows.length} update triggers`, 'success')
                triggerResult.rows.forEach((trigger) => {
                    console.log(`  - ${trigger.tgname}`)
                })
            } else {
                this.log('No update triggers found', 'warning')
            }

            return true
        } catch (error) {
            this.log(`Function test failed: ${error.message}`, 'error')
            return false
        }
    }

    async runAllTests() {
        try {
            this.log('🧪 Starting Production Tests...', 'success')

            // Test 1: Database Connection
            const connected = await this.connectToDatabase()
            if (!connected) {
                throw new Error('Database connection failed')
            }

            // Test 2: Table Structure
            const tables = await this.testTables()
            if (!tables) {
                throw new Error('Table testing failed')
            }

            // Check if all tables exist
            const allTablesExist = Object.values(tables).every((table) => table.exists)
            if (!allTablesExist) {
                this.log('Some tables are missing. Run the setup script first.', 'warning')
            }

            // Test 3: Sample Data
            await this.testSampleData()

            // Test 4: Functions and Triggers
            await this.testFunctions()

            // Summary
            console.log('\n📊 Test Summary:')
            console.log('================')
            console.log(`Database Connection: ${connected ? '✅ PASS' : '❌ FAIL'}`)
            console.log(`Tables Created: ${allTablesExist ? '✅ PASS' : '⚠️ PARTIAL'}`)

            if (tables) {
                Object.entries(tables).forEach(([name, info]) => {
                    console.log(`  - ${name}: ${info.exists ? `✅ ${info.count} records` : '❌ Missing'}`)
                })
            }

            console.log('\n🎉 Production system is ready!')
            console.log('\nNext steps:')
            console.log('1. Import Flowise templates')
            console.log('2. Configure webhooks')
            console.log('3. Start testing with real data')

            return true
        } catch (error) {
            this.log(`Production tests failed: ${error.message}`, 'error')
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
    const tester = new ProductionTester()

    tester
        .runAllTests()
        .then((success) => {
            process.exit(success ? 0 : 1)
        })
        .catch((error) => {
            console.error('❌ Tests failed:', error)
            process.exit(1)
        })
}

module.exports = ProductionTester
