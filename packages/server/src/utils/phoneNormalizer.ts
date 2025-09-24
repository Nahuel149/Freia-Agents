/**
 * Phone number normalization utility for Argentina
 * Automatically adds +549 prefix for local numbers
 */

/**
 * Normalizes a phone number to international format (+549...)
 * @param phoneNumber - The phone number to normalize
 * @returns Normalized phone number with +549 prefix
 */
export const normalizePhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) {
        return phoneNumber
    }

    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '')
    
    // If already has international format, return as is
    if (cleaned.startsWith('+54')) {
        return cleaned
    }
    
    // If starts with 54 but no +, add the +
    if (cleaned.startsWith('54') && cleaned.length >= 12) {
        return '+' + cleaned
    }
    
    // If starts with 9 (mobile prefix), add +549
    if (cleaned.startsWith('9') && cleaned.length >= 10) {
        return '+549' + cleaned.substring(1)
    }
    
    // If it's a local number (10-11 digits), add +549
    if (cleaned.length >= 10 && cleaned.length <= 11) {
        // Remove leading 0 if present (common in local format)
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1)
        }
        return '+549' + cleaned
    }
    
    // If it's shorter, assume it needs area code and mobile prefix
    if (cleaned.length >= 8 && cleaned.length <= 9) {
        // Assume Buenos Aires area code (11) for short numbers
        return '+54911' + cleaned
    }
    
    // Return original if we can't determine format
    return phoneNumber
}

/**
 * Validates if a phone number is in a valid format after normalization
 * @param phoneNumber - The phone number to validate
 * @returns true if valid, false otherwise
 */
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
    const normalized = normalizePhoneNumber(phoneNumber)
    
    // Check if it matches Argentina phone number pattern
    const argentinaPattern = /^\+549\d{8,10}$/
    return argentinaPattern.test(normalized)
}

/**
 * Formats a phone number for display purposes
 * @param phoneNumber - The phone number to format
 * @returns Formatted phone number for display
 */
export const formatPhoneForDisplay = (phoneNumber: string): string => {
    const normalized = normalizePhoneNumber(phoneNumber)
    
    if (normalized.startsWith('+549')) {
        const number = normalized.substring(4) // Remove +549
        if (number.length === 8) {
            // Format: +549 11 1234-5678
            return `+549 ${number.substring(0, 2)} ${number.substring(2, 6)}-${number.substring(6)}`
        } else if (number.length === 9) {
            // Format: +549 11 1234-5678
            return `+549 ${number.substring(0, 2)} ${number.substring(2, 6)}-${number.substring(6)}`
        } else if (number.length === 10) {
            // Format: +549 11 1234-5678
            return `+549 ${number.substring(0, 2)} ${number.substring(2, 6)}-${number.substring(6)}`
        }
    }
    
    return normalized
}