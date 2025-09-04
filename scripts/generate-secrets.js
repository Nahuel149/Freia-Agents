#!/usr/bin/env node

/**
 * Generate secure JWT secrets for Render deployment
 * Run with: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

function generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

console.log('🔐 Generating JWT secrets for Render deployment\n');

const authSecret = generateSecret(32);
const refreshSecret = generateSecret(32);

console.log('Copy these environment variables to your Render service:');
console.log('=' .repeat(60));
console.log(`JWT_AUTH_TOKEN_SECRET=${authSecret}`);
console.log(`JWT_REFRESH_TOKEN_SECRET=${refreshSecret}`);
console.log('=' .repeat(60));

console.log('\n✅ Secrets generated successfully!');
console.log('\n⚠️  Important: Keep these secrets secure and never commit them to your repository.');
console.log('\n📝 Add these to your Render service environment variables.');