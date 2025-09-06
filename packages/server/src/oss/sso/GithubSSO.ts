/**
 * OSS GitHub SSO - stub implementation without enterprise features
 */

import { Application } from 'express'
import SSOBase from './SSOBase'

export default class GithubSSO extends SSOBase {
    static LOGIN_URI = '/api/v1/auth/github/login'
    static LOGOUT_URI = '/api/v1/auth/github/logout'
    static CALLBACK_URI = '/api/v1/auth/github/callback'

    constructor(config: any = {}) {
        super('github', config)
    }

    /**
     * Initialize GitHub SSO (no-op in OSS mode)
     */
    initialize(_app: Application): void {
        // No-op in OSS mode - SSO not supported
    }

    /**
     * GitHub SSO is not enabled in OSS mode
     */
    isEnabled(): boolean {
        return false
    }
}
