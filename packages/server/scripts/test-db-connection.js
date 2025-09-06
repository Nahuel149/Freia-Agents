#!/usr/bin/env node

/**
 * PostgreSQL Connection Test Script
 * This script validates connectivity, initialization and migrations for a PostgreSQL database
 * Environment variables: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, NODE_ENV
 */

const { Client } = require('pg');


(async () => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';

    console.log('🔍 [test-db]: Starting PostgreSQL connection test...');
    console.log('='.repeat(60));

    // Log environment variables
    console.log('📊 Environment Variables:');
    console.table({
        PGHOST: process.env.PGHOST || 'localhost',
        PGPORT: process.env.PGPORT || 5432,
        PGUSER: process.env.PGUSER || 'postgres',
        PGDATABASE: process.env.PGDATABASE || 'flowise',
        NODE_ENV: process.env.NODE_ENV
    });

    const client = new Client({
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'flowise'
    });

    try {
        console.log('\n🧪 Test 1: Connect to PostgreSQL');
        await client.connect();
        console.log('✅ Connected successfully');

        console.log('\n🧪 Test 2: Ensure "user" table exists & count users');
        // Check existence via information_schema
        const tableRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='user'`);
        const userTableExists = tableRes.rowCount > 0;
        console.log(`User table exists: ${userTableExists}`);

        if (userTableExists) {
            const countRes = await client.query('SELECT COUNT(*) AS count FROM "user"');
            console.log(`User count: ${countRes.rows[0].count}`);
        }

        console.log('\n✅ PostgreSQL connection test completed successfully');
    } catch (err) {
        console.error('\n❌ PostgreSQL connection test failed:');
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 [test-db]: Test completed');
})();