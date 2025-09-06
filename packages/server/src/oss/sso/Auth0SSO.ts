/**
 * OSS Auth0 SSO - stub implementation without enterprise features
 */

import { Application } from 'express'
import SSOBase from './SSOBase'

export default class Auth0SSO extends SSOBase {
    static LOGIN_URI = '/api/v1/auth/auth0/login'
    static LOGOUT_URI = '/api/v1/auth/auth0/logout'
    static CALLBACK_URI = '/api/v1/auth/auth0/callback'

    constructor(config: any = {}) {
        super('auth0', config)
    }

    /**
     * Initialize Auth0 SSO (no-op in OSS mode)
     */
    initialize(_app: Application): void {
        // No-op in OSS mode - SSO not supported
    }

    /**
     * Auth0 SSO is not enabled in OSS mode
     */
    isEnabled(): boolean {
        return false
    }
}
