/**
 * OSS Permissions class - simplified version without enterprise RBAC
 */

export class Permissions {
    constructor() {
        // OSS mode doesn't use complex permissions
    }

    /**
     * In OSS mode, all users have all permissions
     */
    hasPermission(_userId: string, _permission: string): boolean {
        return true
    }

    /**
     * In OSS mode, all users have access to all resources
     */
    hasResourceAccess(_userId: string, _resourceType: string, _resourceId: string): boolean {
        return true
    }

    /**
     * Get all permissions for a user (returns empty array in OSS mode)
     */
    getUserPermissions(_userId: string): string[] {
        return []
    }

    /**
     * Check if user is admin (always true in OSS mode)
     */
    isAdmin(_userId: string): boolean {
        return true
    }
}
