import bcrypt from 'bcryptjs'

/**
 * Simplified encryption helpers for OSS mode.
 * In OSS build we reuse the same algorithms but without KMS/secret rotation.
 */
export function getHash(value: string): string {
    const salt = bcrypt.genSaltSync(parseInt(process.env.PASSWORD_SALT_HASH_ROUNDS || '5', 10))
    return bcrypt.hashSync(value, salt)
}

export function compareHash(value1: string, value2: string): boolean {
    return bcrypt.compareSync(value1, value2)
}

// Encryption helpers are no-ops in OSS to avoid external key dependency.
export async function encrypt(value: string): Promise<string> {
    return value
}

export async function decrypt(value: string): Promise<string> {
    return value
}
