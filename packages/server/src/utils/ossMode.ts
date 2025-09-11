import dotenv from 'dotenv'
import path from 'path'
// Ensure environment variables are loaded when this util is imported – this is a safeguard for unit tests
if (!process.env.OSS_MODE) {
    dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: false })
}

/**
 * Helper that tells whether Flowise is running in pure OSS mode.
 * OSS mode disables any enterprise-only functionality such as licensing, workspaces and organizations.
 * The value is derived from the `OSS_MODE` environment variable. When set to the string "true" (case-insensitive),
 * the application is considered OSS. Any other value – or absence of the variable – means enterprise features may be
 * enabled.  
 *
 * NOTE: We intentionally default to `true` when the variable is absent so that local development keeps enterprise
 * code paths disabled unless explicitly re-enabled by setting `OSS_MODE=false`.
 */
export function isOssMode(): boolean {
    const raw = process.env.OSS_MODE ?? 'true'
    return String(raw).toLowerCase() === 'true'
}