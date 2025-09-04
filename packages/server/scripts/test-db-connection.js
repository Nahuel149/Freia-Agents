#!/usr/bin/env node

/**
 * Database Connection Test Script
 * This script tests database connectivity and initialization
 */

const path = require('path');
const fs = require('fs');

// Set up environment for testing
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🔍 [test-db]: Starting database connection test...');
console.log('=' .repeat(60));

// Log environment variables
console.log('📊 Environment Variables:');
console.log(`DATABASE_TYPE: ${process.env.DATABASE_TYPE || 'undefined (will default to sqlite)'}`);
console.log(`DATABASE_PATH: ${process.env.DATABASE_PATH || 'undefined'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Test 1: Check if we can import DataSource
console.log('\n🧪 Test 1: Import DataSource module');
try {
    const { getDataSource } = require('../dist/DataSource');
    console.log('✅ DataSource module imported successfully');
    
    // Test 2: Get DataSource instance
    console.log('\n🧪 Test 2: Get DataSource instance');
    const dataSource = getDataSource();
    console.log('✅ DataSource instance created');
    console.log(`Database type: ${dataSource.options.type}`);
    console.log(`Database path: ${dataSource.options.database}`);
    
    // Test 3: Check if database file exists (for SQLite)
    if (dataSource.options.type === 'sqlite') {
        console.log('\n🧪 Test 3: Check SQLite database file');
        const dbPath = dataSource.options.database;
        console.log(`Expected database file: ${dbPath}`);
        
        const dbDir = path.dirname(dbPath);
        console.log(`Database directory: ${dbDir}`);
        console.log(`Directory exists: ${fs.existsSync(dbDir)}`);
        console.log(`Database file exists: ${fs.existsSync(dbPath)}`);
        
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            console.log(`Database file size: ${stats.size} bytes`);
        }
    }
    
    // Test 4: Initialize DataSource
    console.log('\n🧪 Test 4: Initialize DataSource');
    await dataSource.initialize();
    console.log('✅ DataSource initialized successfully');
    
    // Test 5: Check if migrations table exists
    console.log('\n🧪 Test 5: Check database structure');
    const queryRunner = dataSource.createQueryRunner();
    
    if (dataSource.options.type === 'sqlite') {
        const tables = await queryRunner.query(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        console.log(`Tables found: ${tables.map(t => t.name).join(', ')}`);
        
        // Check if user table exists
        const userTableExists = tables.some(t => t.name === 'user');
        console.log(`User table exists: ${userTableExists}`);
        
        if (userTableExists) {
            const userCount = await queryRunner.query('SELECT COUNT(*) as count FROM user');
            console.log(`User count: ${userCount[0].count}`);
        }
    }
    
    await queryRunner.release();
    
    // Test 6: Run migrations
    console.log('\n🧪 Test 6: Run migrations');
    const pendingMigrations = await dataSource.showMigrations();
    console.log(`Pending migrations: ${pendingMigrations.length}`);
    
    if (pendingMigrations.length > 0) {
        console.log('Running migrations...');
        await dataSource.runMigrations({ transaction: 'each' });
        console.log('✅ Migrations completed');
    } else {
        console.log('✅ No pending migrations');
    }
    
    // Close connection
    await dataSource.destroy();
    console.log('\n✅ Database connection test completed successfully');
    
} catch (error) {
    console.error('\n❌ Database connection test failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
}

console.log('\n' + '=' .repeat(60));
console.log('🏁 [test-db]: Database test completed');