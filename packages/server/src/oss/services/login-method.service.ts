/**
 * OSS Login Method Service - simplified version without enterprise features
 */

import { LoginMethodStatus, LoginMethod } from '../database/entities/login-method.entity'

export class LoginMethodService {
    constructor() {
        // OSS mode uses simple login methods
    }

    /**
     * Get login method status (always enabled in OSS mode)
     */
    async getLoginMethodStatus(method: string): Promise<LoginMethod> {
        return {
            id: '1',
            organizationId: 'default-org',
            name: method,
            config: {},
            status: LoginMethodStatus.ENABLE,
            createdDate: new Date(),
            updatedDate: new Date()
        }
    }

    /**
     * Check if login method is enabled (always true in OSS mode)
     */
    async isLoginMethodEnabled(_method: string): Promise<boolean> {
        return true
    }

    /**
     * Enable login method (no-op in OSS mode)
     */
    async enableLoginMethod(_method: string, _config?: any): Promise<void> {
        // No-op in OSS mode
    }

    /**
     * Disable login method (no-op in OSS mode)
     */
    async disableLoginMethod(_method: string): Promise<void> {
        // No-op in OSS mode
    }

    /**
     * Read login methods by organization ID (returns empty array in OSS mode)
     */
    async readLoginMethodByOrganizationId(_organizationId: string, _queryRunner?: any): Promise<LoginMethod[]> {
        return []
    }

    /**
     * Decrypt login method config (returns config as-is in OSS mode)
     */
    async decryptLoginMethodConfig(config: string): Promise<string> {
        return config
    }
}
