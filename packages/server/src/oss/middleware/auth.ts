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
        
        let activeWorkspaceId = null;
        let activeWorkspace = null;
        let activeOrganizationId = null;
        
        if (firstWorkspace) {
            activeWorkspaceId = firstWorkspace.id;
            activeWorkspace = firstWorkspace.name;
            activeOrganizationId = firstWorkspace.organizationId;
        } else {
            // Create default organization if none exists
            const Organization = require('../database/entities/organization.entity').Organization;
            const orgRepo = queryRunner.manager.getRepository(Organization);
            let defaultOrg = await orgRepo.findOne({ where: { name: 'Default Organization' } });
            if (!defaultOrg) {
                defaultOrg = orgRepo.create({ name: 'Default Organization' });
                await orgRepo.save(defaultOrg);
            }
            activeOrganizationId = defaultOrg.id;
            
            // Create default workspace
            const Workspace = require('../database/entities/workspace.entity').Workspace;
            const workspaceRepo = queryRunner.manager.getRepository(Workspace);
            let defaultWorkspace = await workspaceRepo.findOne({ where: { name: 'Default Workspace', organizationId: defaultOrg.id } });
            if (!defaultWorkspace) {
                defaultWorkspace = workspaceRepo.create({
                    name: 'Default Workspace',
                    organizationId: defaultOrg.id
                });
                await workspaceRepo.save(defaultWorkspace);
            }
            activeWorkspaceId = defaultWorkspace.id;
            activeWorkspace = defaultWorkspace.name;
        }
        
        if (!activeWorkspaceId) {
            throw new Error('Failed to initialize workspace');
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
