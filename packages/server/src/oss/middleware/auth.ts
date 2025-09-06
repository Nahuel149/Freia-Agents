/**
 * OSS Authentication middleware - simplified version without enterprise features
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { LoggedInUser } from '../Interface'

/**
 * Simple JWT verification for OSS mode
 */
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token

        if (!token) {
            // In OSS mode, create a default user if no token
            req.user = createDefaultOSSUser()
            return next()
        }

        const decoded = jwt.verify(token, process.env.FLOWISE_SECRETKEY_OVERWRITE || 'mySecretKey') as any
        req.user = decoded
        next()
    } catch (error) {
        // If token verification fails, create default user in OSS mode
        req.user = createDefaultOSSUser()
        next()
    }
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
 * Create a default OSS user when no authentication is present
 */
function createDefaultOSSUser(): LoggedInUser {
    return {
        id: 'oss-user',
        email: 'user@localhost',
        name: 'OSS User',
        roleId: 'admin',
        activeOrganizationId: 'default-org',
        activeOrganizationSubscriptionId: null,
        activeOrganizationCustomerId: null,
        activeOrganizationProductId: null,
        isOrganizationAdmin: true,
        activeWorkspaceId: 'default-workspace',
        activeWorkspace: 'Default Workspace',
        assignedWorkspaces: [],
        isApiKeyValidated: false,
        permissions: [],
        features: {}
    }
}
