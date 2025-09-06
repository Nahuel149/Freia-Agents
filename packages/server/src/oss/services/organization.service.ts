/**
 * OSS Organization Service - simplified version without enterprise features
 */

import { Organization } from '../database/entities/organization.entity'

export class OrganizationService {
    constructor() {
        // OSS mode uses simple organization management
    }

    /**
     * Get organization by ID (returns default org in OSS mode)
     */
    async getOrganizationById(_id: string): Promise<Organization | null> {
        return {
            id: 'default-org',
            name: 'Default Organization',
            createdDate: new Date(),
            updatedDate: new Date(),
            createdBy: null,
            updatedBy: null,
            customerId: null,
            subscriptionId: null
        }
    }

    /**
     * Get user's organizations (returns default org in OSS mode)
     */
    async getUserOrganizations(_userId: string): Promise<Organization[]> {
        const defaultOrg = await this.getOrganizationById('default-org')
        return defaultOrg ? [defaultOrg] : []
    }

    /**
     * Create organization (returns default org in OSS mode)
     */
    async createOrganization(name: string, _description?: string): Promise<Organization> {
        return {
            id: 'default-org',
            name: name || 'Default Organization',
            createdDate: new Date(),
            updatedDate: new Date(),
            createdBy: null,
            updatedBy: null,
            customerId: null,
            subscriptionId: null
        }
    }

    /**
     * Check if user is organization admin (always true in OSS mode)
     */
    async isOrganizationAdmin(_userId: string, _organizationId: string): Promise<boolean> {
        return true
    }

    /**
     * Read organizations (returns empty array in OSS mode)
     */
    async readOrganization(_queryRunner?: any): Promise<Organization[]> {
        return []
    }
}
