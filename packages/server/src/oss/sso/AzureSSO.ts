/**
 * OSS Azure SSO - stub implementation without enterprise features
 */

import { Application } from 'express'
import SSOBase from './SSOBase'

export default class AzureSSO extends SSOBase {
    static LOGIN_URI = '/api/v1/auth/azure/login'
    static LOGOUT_URI = '/api/v1/auth/azure/logout'
    static CALLBACK_URI = '/api/v1/auth/azure/callback'

    constructor(config: any = {}) {
        super('azure', config)
    }

    /**
     * Initialize Azure SSO (no-op in OSS mode)
     */
    initialize(_app: Application): void {
        // No-op in OSS mode - SSO not supported
    }

    /**
     * Azure SSO is not enabled in OSS mode
     */
    isEnabled(): boolean {
        return false
    }
}
