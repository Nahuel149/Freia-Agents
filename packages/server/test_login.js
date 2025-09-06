// Test script to verify user login against PostgreSQL database
// Usage: node test_login.js
// Environment variables: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, TEST_EMAIL, TEST_PASSWORD

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function testLogin() {
    const client = new Client({
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'flowise'
    });

    const email = process.env.TEST_EMAIL || 'user@example.com';
    const inputPassword = process.env.TEST_PASSWORD || 'Testing123!';

    console.log('🔍 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected');

    try {
        const res = await client.query(
            'SELECT id, name, email, credential, status, "createdDate" FROM "user" WHERE email = $1 LIMIT 1',
            [email]
        );

        if (res.rowCount === 0) {
            console.log(`❌ User with email ${email} not found.`);
            return;
        }

        const row = res.rows[0];
        console.log('\n✅ User found:');
        console.table(row);

        if (!row.credential) {
            console.log('❌ No credential stored for user');
            return;
        }

        let isPasswordValid;
        if (row.credential && row.credential.startsWith('$2')) {
            // Stored value is a bcrypt hash
            isPasswordValid = bcrypt.compareSync(inputPassword, row.credential);
        } else {
            // Stored value appears to be plaintext (development/seed)
            isPasswordValid = inputPassword === row.credential;
        }
        console.log('\n🔍 Password verification:');
        console.log(`Password match: ${isPasswordValid ? '✅ SUCCESS!' : '❌ FAILED'}`);

        if (isPasswordValid) {
            console.log('\n🎉 AUTHENTICATION SUCCESSFUL!');
        }
    } catch (err) {
        console.error('❌ Query error:', err);
    } finally {
        await client.end();
    }
}

testLogin().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});