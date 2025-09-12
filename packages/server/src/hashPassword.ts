import bcrypt from 'bcryptjs';

function getHash(value: string): string {
    const saltRounds = parseInt(process.env.PASSWORD_SALT_HASH_ROUNDS || '10', 10);
    if (saltRounds < 10) {
        console.warn('Warning: PASSWORD_SALT_HASH_ROUNDS is set to less than 10, which is not recommended for production');
    }
    const salt = bcrypt.genSaltSync(saltRounds);
    return bcrypt.hashSync(value, salt);
}

// Remove hardcoded password - this should be provided as a command line argument or environment variable
const password = process.argv[2] || process.env.PASSWORD_TO_HASH;
if (!password) {
    console.error('Error: Please provide a password as a command line argument or set PASSWORD_TO_HASH environment variable');
    console.error('Usage: node hashPassword.js <password>');
    process.exit(1);
}

const hashed = getHash(password);
console.log('Hashed password:', hashed);