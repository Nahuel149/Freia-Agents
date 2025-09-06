import bcrypt from 'bcryptjs';

function getHash(value: string): string {
    const salt = bcrypt.genSaltSync(parseInt(process.env.PASSWORD_SALT_HASH_ROUNDS || '5', 10));
    return bcrypt.hashSync(value, salt);
}

const password = 'Testing123!';
const hashed = getHash(password);
console.log('Hashed password:', hashed);