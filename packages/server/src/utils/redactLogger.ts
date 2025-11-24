export const redact = (value: any) => {
    try {
        return JSON.stringify(value, (_key, val) => {
            if (typeof val === 'string' && val.length > 8 && /\d{10,}/.test(val)) return '***redacted***'
            return val
        })
    } catch {
        return value
    }
}

export const logInfo = (...args: any[]) => console.log('[INFO]', ...args.map(redact))
export const logWarn = (...args: any[]) => console.warn('[WARN]', ...args.map(redact))
export const logError = (...args: any[]) => console.error('[ERROR]', ...args.map(redact))
