#!/usr/bin/env node

/**
 * PostgreSQL Setup Validation Script
 *
 * This script validates that your PostgreSQL database is properly configured
 * and ready for use with the Flowise application.
 */

const { Pool } = require('pg')
require('dotenv').config()

class PostgreSQLValidator {
    constructor() {
        this.pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB || 'flowise',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD,
            ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
            max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
            idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
            connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 2000
        })

        this.results = {
            connection: false,
            tables: false,
            indexes: false,
            constraints: false,
            data: false,
            performance: false
        }
    }

    async validateConnection() {
        console.log('🔌 Testing database connection...')
        try {
            const client = await this.pool.connect()
            const result = await client.query('SELECT NOW() as current_time, version() as pg_version')
            client.release()

            console.log('✅ Connection successful!')
            console.log(`   PostgreSQL Version: ${result.rows[0].pg_version.split(',')[0]}`)
            console.log(`   Current Time: ${result.rows[0].current_time}`)

            this.results.connection = true
            return true
        } catch (error) {
            console.error('❌ Connection failed:', error.message)
            return false
        }
    }

    async validateTables() {
        console.log('\n📋 Validating database tables...')

        const requiredTables = [
            'chat_flow',
            'chat_message',
            'credential',
            'tool',
            'api_key',
            'assistant',
            'user',
            'organization',
            'role',
            'login_method',
            'organization_user',
            'workspace',
            'workspace_user',
            'login_activity'
        ]

        try {
            const query = `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            `

            const result = await this.pool.query(query)
            const existingTables = result.rows.map((row) => row.table_name)

            console.log(`   Found ${existingTables.length} tables:`)

            const missingTables = []
            for (const table of requiredTables) {
                if (existingTables.includes(table)) {
                    console.log(`   ✅ ${table}`)
                } else {
                    console.log(`   ❌ ${table} (missing)`)
                    missingTables.push(table)
                }
            }

            if (missingTables.length === 0) {
                console.log('✅ All required tables exist!')
                this.results.tables = true
                return true
            } else {
                console.log(`❌ Missing ${missingTables.length} required tables`)
                return false
            }
        } catch (error) {
            console.error('❌ Table validation failed:', error.message)
            return false
        }
    }

    async validateIndexes() {
        console.log('\n🔍 Validating database indexes...')

        try {
            const query = `
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    indexdef
                FROM pg_indexes 
                WHERE schemaname = 'public'
                ORDER BY tablename, indexname;
            `

            const result = await this.pool.query(query)
            const indexes = result.rows

            console.log(`   Found ${indexes.length} indexes:`)

            // Check for important indexes
            const importantIndexes = [
                'chat_message_chatflowid_idx',
                'chat_message_sessionid_idx',
                'user_email_idx',
                'organization_user_user_id_idx'
            ]

            const existingIndexNames = indexes.map((idx) => idx.indexname)

            for (const indexName of importantIndexes) {
                if (existingIndexNames.some((name) => name.includes(indexName.replace('_idx', '')))) {
                    console.log(`   ✅ ${indexName} (or similar)`)
                } else {
                    console.log(`   ⚠️  ${indexName} (recommended but missing)`)
                }
            }

            console.log('✅ Index validation completed!')
            this.results.indexes = true
            return true
        } catch (error) {
            console.error('❌ Index validation failed:', error.message)
            return false
        }
    }

    async validateConstraints() {
        console.log('\n🔗 Validating foreign key constraints...')

        try {
            const query = `
                SELECT 
                    tc.table_name,
                    tc.constraint_name,
                    tc.constraint_type,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                LEFT JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = 'public'
                ORDER BY tc.table_name, tc.constraint_name;
            `

            const result = await this.pool.query(query)
            const constraints = result.rows

            console.log(`   Found ${constraints.length} foreign key constraints:`)

            // Group by table
            const constraintsByTable = {}
            constraints.forEach((constraint) => {
                if (!constraintsByTable[constraint.table_name]) {
                    constraintsByTable[constraint.table_name] = []
                }
                constraintsByTable[constraint.table_name].push(constraint)
            })

            Object.keys(constraintsByTable).forEach((tableName) => {
                console.log(`   📋 ${tableName}: ${constraintsByTable[tableName].length} constraints`)
            })

            console.log('✅ Constraint validation completed!')
            this.results.constraints = true
            return true
        } catch (error) {
            console.error('❌ Constraint validation failed:', error.message)
            return false
        }
    }

    async validateData() {
        console.log('\n📊 Validating initial data...')

        try {
            // Check for admin user
            const userResult = await this.pool.query('SELECT COUNT(*) as count FROM "user" WHERE email = $1', ['admin@flowise.ai'])

            if (userResult.rows[0].count > 0) {
                console.log('   ✅ Admin user exists')
            } else {
                console.log('   ⚠️  Admin user not found (will be created on first login)')
            }

            // Check for default organization
            const orgResult = await this.pool.query('SELECT COUNT(*) as count FROM organization WHERE name = $1', ['Default Organization'])

            if (orgResult.rows[0].count > 0) {
                console.log('   ✅ Default organization exists')
            } else {
                console.log('   ⚠️  Default organization not found')
            }

            // Check for default role
            const roleResult = await this.pool.query('SELECT COUNT(*) as count FROM role WHERE name = $1', ['Admin'])

            if (roleResult.rows[0].count > 0) {
                console.log('   ✅ Admin role exists')
            } else {
                console.log('   ⚠️  Admin role not found')
            }

            console.log('✅ Data validation completed!')
            this.results.data = true
            return true
        } catch (error) {
            console.error('❌ Data validation failed:', error.message)
            return false
        }
    }

    async validatePerformance() {
        console.log('\n⚡ Testing database performance...')

        try {
            const startTime = Date.now()

            // Test simple query performance
            await this.pool.query('SELECT 1')
            const simpleQueryTime = Date.now() - startTime

            // Test connection pool
            const poolStartTime = Date.now()
            const promises = []
            for (let i = 0; i < 5; i++) {
                promises.push(this.pool.query('SELECT $1 as test_value', [i]))
            }
            await Promise.all(promises)
            const poolTestTime = Date.now() - poolStartTime

            console.log(`   Simple query time: ${simpleQueryTime}ms`)
            console.log(`   Pool test (5 concurrent queries): ${poolTestTime}ms`)

            if (simpleQueryTime < 100 && poolTestTime < 500) {
                console.log('✅ Performance looks good!')
            } else {
                console.log('⚠️  Performance might be slow - check network latency')
            }

            this.results.performance = true
            return true
        } catch (error) {
            console.error('❌ Performance test failed:', error.message)
            return false
        }
    }

    async generateReport() {
        console.log('\n📋 VALIDATION REPORT')
        console.log('='.repeat(50))

        const checks = [
            { name: 'Database Connection', status: this.results.connection },
            { name: 'Required Tables', status: this.results.tables },
            { name: 'Database Indexes', status: this.results.indexes },
            { name: 'Foreign Key Constraints', status: this.results.constraints },
            { name: 'Initial Data', status: this.results.data },
            { name: 'Performance Test', status: this.results.performance }
        ]

        let passedChecks = 0
        checks.forEach((check) => {
            const status = check.status ? '✅ PASS' : '❌ FAIL'
            console.log(`${check.name.padEnd(25)} ${status}`)
            if (check.status) passedChecks++
        })

        console.log('='.repeat(50))
        console.log(`Overall Score: ${passedChecks}/${checks.length} checks passed`)

        if (passedChecks === checks.length) {
            console.log('🎉 Your PostgreSQL setup is ready for production!')
        } else if (passedChecks >= 4) {
            console.log('⚠️  Your setup is mostly ready, but some issues need attention.')
        } else {
            console.log('❌ Your setup needs significant work before production use.')
        }

        return passedChecks === checks.length
    }

    async run() {
        console.log('🚀 Starting PostgreSQL Setup Validation')
        console.log('='.repeat(50))

        try {
            await this.validateConnection()
            await this.validateTables()
            await this.validateIndexes()
            await this.validateConstraints()
            await this.validateData()
            await this.validatePerformance()

            const success = await this.generateReport()

            await this.pool.end()
            process.exit(success ? 0 : 1)
        } catch (error) {
            console.error('\n💥 Validation failed with error:', error.message)
            await this.pool.end()
            process.exit(1)
        }
    }
}

// Run validation if this script is executed directly
if (require.main === module) {
    const validator = new PostgreSQLValidator()
    validator.run()
}

module.exports = PostgreSQLValidator
