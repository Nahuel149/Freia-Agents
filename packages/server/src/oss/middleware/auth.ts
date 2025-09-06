/**
 * OSS Authentication middleware - simplified version without enterprise features
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { LoggedInUser } from '../Interface'

/**
 * Simple JWT verification for OSS mode
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token

        if (!token) {
            // In OSS mode, create a default user if no token
            req.user = await createDefaultOSSUser()
            return next()
        }

        const decoded = jwt.verify(token, process.env.FLOWISE_SECRETKEY_OVERWRITE || 'mySecretKey') as any
        req.user = decoded
        next()
    } catch (error) {
        // If token verification fails, create default user in OSS mode
        req.user = await createDefaultOSSUser()
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
async function createDefaultOSSUser(): Promise<LoggedInUser> {
    // Get the first available workspace from database
    const app = require('../../utils/getRunningExpressApp').getRunningExpressApp()
    const dataSource = app.AppDataSource
    const queryRunner = dataSource.createQueryRunner()
    await queryRunner.connect()
    
    try {
        const workspaceRepo = queryRunner.manager.getRepository(require('../database/entities/workspace.entity').Workspace)
        const firstWorkspace = await workspaceRepo.findOne({
            order: { createdDate: 'ASC' }
        })
        
        let activeWorkspaceId = 'default-workspace'
        let activeWorkspace = 'Default Workspace'
        let activeOrganizationId = 'default-org'
        
        if (firstWorkspace) {
            activeWorkspaceId = firstWorkspace.id
            activeWorkspace = firstWorkspace.name
            activeOrganizationId = firstWorkspace.organizationId
        }
        
        return {
            id: 'oss-user',
            email: 'user@localhost',
            name: 'OSS User',
            roleId: 'admin',
            activeOrganizationId,
            activeOrganizationSubscriptionId: null,
            activeOrganizationCustomerId: null,
            activeOrganizationProductId: null,
            isOrganizationAdmin: true,
            activeWorkspaceId,
            activeWorkspace,
            assignedWorkspaces: [],
            isApiKeyValidated: false,
            permissions: [],
            features: {}
        }
    } finally {
        await queryRunner.release()
    }
}
