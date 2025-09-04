const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Database path
const dbPath = path.join(os.homedir(), '.flowise', 'database.sqlite');

// Test login function with the correct password
function testLogin() {
    const db = new sqlite3.Database(dbPath);
    
    const email = 'nahuelbalsas199@gmail.com';
    const correctPassword = 'Testing123!'; // The actual password
    
    console.log('Testing login for:', email);
    console.log('Testing with password:', correctPassword);
    console.log('Database path:', dbPath);
    
    db.get('SELECT id, name, email, credential, status, createdDate FROM user WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            db.close();
            return;
        }
        
        if (!row) {
            console.log('❌ User not found in database');
            db.close();
            return;
        }
        
        console.log('\n✅ User found:');
        console.log('  ID:', row.id);
        console.log('  Name:', row.name);
        console.log('  Email:', row.email);
        console.log('  Status:', row.status);
        console.log('  Created:', row.createdDate);
        
        if (!row.credential) {
            console.log('❌ No credential stored for user');
            db.close();
            return;
        }
        
        // Test password comparison
        const isPasswordValid = bcrypt.compareSync(correctPassword, row.credential);
        console.log('\n🔍 Password verification:');
        console.log('  Input password:', correctPassword);
        console.log('  Stored hash:', row.credential.substring(0, 20) + '...');
        console.log('  Password match:', isPasswordValid ? '✅ SUCCESS!' : '❌ FAILED');
        
        if (isPasswordValid) {
            console.log('\n🎉 AUTHENTICATION SUCCESSFUL!');
            console.log('The password "Testing123!" is correct for this user.');
            console.log('\n📋 Next steps for Render deployment:');
            console.log('  1. Configure database environment variables');
            console.log('  2. Set up proper database connection for production');
            console.log('  3. Ensure database migrations run correctly');
        } else {
            console.log('\n❌ Password still doesn\'t match.');
            console.log('There might be an issue with the stored hash.');
        }
        
        db.close();
    });
}

testLogin();