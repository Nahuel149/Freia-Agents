/**
 * OSS Authentication middleware - simplified version without enterprise features
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { LoggedInUser } from '../Interface'

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = (req.headers['authorization'] as string) || ''
        const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null
        // Optionally allow token via cookie
        const cookieToken = (req as any).cookies?.token
        const token = bearerToken || cookieToken

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized Access' })
        }

        const decoded = jwt.verify(token, process.env.FLOWISE_SECRETKEY_OVERWRITE || 'mySecretKey') as any
        const app = require('../../utils/getRunningExpressApp').getRunningExpressApp()
        const ds = app.AppDataSource
        const userRepo = ds.getRepository(require('../database/entities/user.entity').User)
        const workspaceRepo = ds.getRepository(require('../database/entities/workspace.entity').Workspace)
        const workspaceUserRepo = ds.getRepository(require('../database/entities/workspace-user.entity').WorkspaceUser)

        const user = await userRepo.findOne({ where: { id: decoded.id } })
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized Access' })
        }

        let activeWorkspaceId = user.activeWorkspaceId || decoded.activeWorkspaceId || undefined
        let activeWorkspace = decoded.activeWorkspace || 'Workspace'
        if (!activeWorkspaceId) {
            const existing = await workspaceUserRepo.findOne({ where: { userId: user.id } })
            if (existing) {
                activeWorkspaceId = existing.workspaceId as any
                const ws = await workspaceRepo.findOne({ where: { id: activeWorkspaceId as any } })
                activeWorkspace = ws?.name || activeWorkspace
            }
        } else {
            const ws = await workspaceRepo.findOne({ where: { id: activeWorkspaceId as any } })
            activeWorkspace = ws?.name || activeWorkspace
        }

        const role = decoded.role || user.userType || 'user'
        const permissions = decoded.permissions || (role === 'super-admin' ? ['*'] : [])

        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            roleId: role,
            role,
            orgId: null,
            activeOrganizationId: null,
            activeOrganizationSubscriptionId: null,
            activeOrganizationCustomerId: null,
            activeOrganizationProductId: null,
            isOrganizationAdmin: role === 'super-admin',
            activeWorkspaceId: activeWorkspaceId,
            activeWorkspace,
            assignedWorkspaces: activeWorkspaceId ? [{ id: activeWorkspaceId, name: activeWorkspace }] : [],
            isApiKeyValidated: false,
            permissions,
            features: decoded.features || {}
        }
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized Access' })
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
