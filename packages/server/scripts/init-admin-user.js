const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const Database = require('better-sqlite3')

// Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@freia.ai'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Testing123!'
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin'
const DATABASE_PATH = process.env.DATABASE_PATH || '/opt/render/project/.flowise'
const DB_FILE = path.join(DATABASE_PATH, 'database.sqlite')

console.log('🚀 [init-admin]: Starting admin user initialization...')
console.log(`📁 [init-admin]: Database path: ${DATABASE_PATH}`)
console.log(`📄 [init-admin]: Database file: ${DB_FILE}`)

// Ensure the directory exists
if (!fs.existsSync(DATABASE_PATH)) {
    fs.mkdirSync(DATABASE_PATH, { recursive: true })
    console.log(`📁 [init-admin]: Created directory: ${DATABASE_PATH}`)
}

try {
    // Check if database file exists
    const dbExists = fs.existsSync(DB_FILE)
    console.log(`📄 [init-admin]: Database exists: ${dbExists}`)

    if (!dbExists) {
        console.log('⚠️  [init-admin]: Database file does not exist. This script should run after migrations.')
        console.log('ℹ️  [init-admin]: The application will create the database during startup.')
        process.exit(0)
    }

    // Open database connection
    const db = new Database(DB_FILE)
    console.log('✅ [init-admin]: Connected to database')

    // Check if user table exists
    const tableExists = db
        .prepare(
            `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='user'
    `
        )
        .get()

    if (!tableExists) {
        console.log('⚠️  [init-admin]: User table does not exist yet. Skipping admin user creation.')
        db.close()
        process.exit(0)
    }

    // Check if admin user already exists
    const existingUser = db
        .prepare(
            `
        SELECT id, email FROM user WHERE email = ?
    `
        )
        .get(ADMIN_EMAIL)

    if (existingUser) {
        console.log(`✅ [init-admin]: Admin user already exists: ${existingUser.email}`)
        db.close()
        process.exit(0)
    }

    // Create admin user
    const userId = uuidv4()
    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10)
    const now = new Date().toISOString()

    const insertUser = db.prepare(`
        INSERT INTO user (
            id, name, email, credential, status, 
            createdDate, updatedDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    insertUser.run(userId, ADMIN_NAME, ADMIN_EMAIL, hashedPassword, 'active', now, now)

    console.log('🎉 [init-admin]: Admin user created successfully!')
    console.log(`📧 [init-admin]: Email: ${ADMIN_EMAIL}`)
    console.log(`👤 [init-admin]: Name: ${ADMIN_NAME}`)
    console.log(`🔐 [init-admin]: Password: ${ADMIN_PASSWORD}`)
    console.log(`🆔 [init-admin]: User ID: ${userId}`)

    db.close()
    console.log('✅ [init-admin]: Database connection closed')
} catch (error) {
    console.error('❌ [init-admin]: Error during admin user initialization:', error)
    process.exit(1)
}

console.log('🏁 [init-admin]: Admin user initialization completed')
