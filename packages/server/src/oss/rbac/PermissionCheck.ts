/**
 * OSS permission check stubs - replaces enterprise RBAC system
 * In OSS mode, all permission checks pass since there's no role-based access control
 */

import { Request, Response, NextFunction } from 'express'

/**
 * OSS stub for permission checking - always allows access
 */
export const checkPermission = (_permission: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // In OSS mode, all users have all permissions
        next()
    }
}

/**
 * OSS stub for checking any of multiple permissions - always allows access
 */
export const checkAnyPermission = (_permissions: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // In OSS mode, all users have all permissions
        next()
    }
}

/**
 * OSS stub for workspace permission checking - always allows access
 */
export const checkWorkspacePermission = (_permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // In OSS mode, all users have workspace access
        next()
    }
}
