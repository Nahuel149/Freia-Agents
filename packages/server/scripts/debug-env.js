#!/usr/bin/env node

/**
 * Debug Environment Variables Script
 * This script helps diagnose environment variable issues on Render
 */

console.log('🔍 [debug-env]: Environment Variables Debug Report');
console.log('=' .repeat(50));

// Core environment variables
console.log('📊 Core Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`DATABASE_TYPE: ${process.env.DATABASE_TYPE || 'undefined'}`);
console.log(`DATABASE_PATH: ${process.env.DATABASE_PATH || 'undefined'}`);
console.log(`PORT: ${process.env.PORT || 'undefined'}`);
console.log(`HOST: ${process.env.HOST || 'undefined'}`);

// Database-related variables
console.log('\n🗄️  Database Variables:');
console.log(`DATABASE_HOST: ${process.env.DATABASE_HOST || 'undefined'}`);
console.log(`DATABASE_PORT: ${process.env.DATABASE_PORT || 'undefined'}`);
console.log(`DATABASE_NAME: ${process.env.DATABASE_NAME || 'undefined'}`);
console.log(`DATABASE_USER: ${process.env.DATABASE_USER || 'undefined'}`);
console.log(`DATABASE_PASSWORD: ${process.env.DATABASE_PASSWORD ? '[REDACTED]' : 'undefined'}`);
console.log(`DATABASE_SSL: ${process.env.DATABASE_SSL || 'undefined'}`);

// Admin user variables
console.log('\n👤 Admin User Variables:');
console.log(`ADMIN_EMAIL: ${process.env.ADMIN_EMAIL || 'undefined'}`);
console.log(`ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '[REDACTED]' : 'undefined'}`);
console.log(`ADMIN_NAME: ${process.env.ADMIN_NAME || 'undefined'}`);

// Path variables
console.log('\n📁 Path Variables:');
console.log(`APIKEY_PATH: ${process.env.APIKEY_PATH || 'undefined'}`);
console.log(`SECRETKEY_PATH: ${process.env.SECRETKEY_PATH || 'undefined'}`);
console.log(`LOG_PATH: ${process.env.LOG_PATH || 'undefined'}`);
console.log(`BLOB_STORAGE_PATH: ${process.env.BLOB_STORAGE_PATH || 'undefined'}`);

// Check file system
console.log('\n📂 File System Check:');
const fs = require('fs');
const path = require('path');

const databasePath = process.env.DATABASE_PATH || '/opt/render/project/.flowise';
console.log(`Database directory exists: ${fs.existsSync(databasePath)}`);

if (fs.existsSync(databasePath)) {
    const dbFile = path.join(databasePath, 'database.sqlite');
    console.log(`Database file exists: ${fs.existsSync(dbFile)}`);
    
    if (fs.existsSync(dbFile)) {
        const stats = fs.statSync(dbFile);
        console.log(`Database file size: ${stats.size} bytes`);
        console.log(`Database file modified: ${stats.mtime}`);
    }
    
    // List directory contents
    try {
        const files = fs.readdirSync(databasePath);
        console.log(`Directory contents: ${files.join(', ')}`);
    } catch (err) {
        console.log(`Error reading directory: ${err.message}`);
    }
}

// Test database connection
console.log('\n🔌 Database Connection Test:');
try {
    // Import DataSource configuration
    const { getUserHome } = require('../dist/utils');
    
    console.log(`User home directory: ${getUserHome()}`);
    console.log(`Resolved database path: ${path.resolve(databasePath, 'database.sqlite')}`);
    
    // Check if we can create a simple SQLite connection
    const Database = require('better-sqlite3');
    const dbPath = path.resolve(databasePath, 'database.sqlite');
    
    if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        
        // Check if user table exists
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log(`Database tables: ${tables.map(t => t.name).join(', ')}`);
        
        if (tables.some(t => t.name === 'user')) {
            const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get();
            console.log(`User count: ${userCount.count}`);
        }
        
        db.close();
    }
} catch (err) {
    console.log(`Database connection test failed: ${err.message}`);
}

console.log('\n' + '=' .repeat(50));
console.log('🏁 [debug-env]: Debug report completed');