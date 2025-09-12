/**
 * OSS Authentication middleware - simplified version without enterprise features
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { LoggedInUser } from '../Interface'

/**
 * Complete bypass for OSS mode - no authentication required
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    // Always create a default admin user with full access - no authentication required
    req.user = createBypassUser()
    next()
}

/**
 * Initialize JWT cookie middleware for OSS mode
 */
export const initializeJwtCookieMiddleware = () => {
    // Simple middleware that doesn't require complex setup
    return (req: Request, res: Response, next: NextFunction) => {
        next()
    }
}

/**
 * Create a bypass user with full admin access - no database checks required
 */
function createBypassUser(): LoggedInUser {
    return {
        id: 'oss-admin',
        email: 'admin@localhost',
        name: 'OSS Admin',
        roleId: 'super-admin',
        orgId: 'oss-mode',
        activeOrganizationId: 'oss-mode',
        activeOrganizationSubscriptionId: null,
        activeOrganizationCustomerId: null,
        activeOrganizationProductId: null,
        isOrganizationAdmin: true,
        activeWorkspaceId: 'oss-mode',
        activeWorkspace: 'OSS Mode',
        assignedWorkspaces: [{ id: 'oss-mode', name: 'OSS Mode' }],
        isApiKeyValidated: true,
        permissions: ['*'], // All permissions
        features: {} // All features enabled
    }
}
