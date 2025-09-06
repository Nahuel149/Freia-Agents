/**
 * OSS SSO Base class - simplified version without enterprise SSO features
 */

import { Application } from 'express'

export default abstract class SSOBase {
    protected providerName: string
    protected config: any

    constructor(providerName: string, config: any = {}) {
        this.providerName = providerName
        this.config = config
    }

    /**
     * Initialize SSO provider (no-op in OSS mode)
     */
    abstract initialize(app: Application): void

    /**
     * Get provider name
     */
    getProviderName(): string {
        return this.providerName
    }

    /**
     * Get provider config
     */
    getConfig(): any {
        return this.config
    }

    /**
     * Check if provider is enabled (always false in OSS mode)
     */
    isEnabled(): boolean {
        return false
    }

    /**
     * Get refresh token (not supported in OSS mode)
     */
    async getRefreshToken(_refreshToken: string): Promise<any> {
        throw new Error('SSO refresh tokens not supported in OSS mode')
    }

    /**
     * Legacy method name for compatibility
     */
    async refreshToken(refreshToken: string): Promise<any> {
        return this.getRefreshToken(refreshToken)
    }

    /**
     * Set SSO configuration
     */
    setSSOConfig(config: any): void {
        this.config = config
    }
}
