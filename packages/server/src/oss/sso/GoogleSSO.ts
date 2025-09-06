/**
 * OSS Google SSO - stub implementation without enterprise features
 */

import { Application } from 'express'
import SSOBase from './SSOBase'

export default class GoogleSSO extends SSOBase {
    static LOGIN_URI = '/api/v1/auth/google/login'
    static LOGOUT_URI = '/api/v1/auth/google/logout'
    static CALLBACK_URI = '/api/v1/auth/google/callback'

    constructor(config: any = {}) {
        super('google', config)
    }

    /**
     * Initialize Google SSO (no-op in OSS mode)
     */
    initialize(_app: Application): void {
        // No-op in OSS mode - SSO not supported
    }

    /**
     * Google SSO is not enabled in OSS mode
     */
    isEnabled(): boolean {
        return false
    }
}
