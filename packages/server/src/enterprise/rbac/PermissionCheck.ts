import { NextFunction, Request, Response } from 'express'

/**
 * OSS mode: RBAC is disabled. All permission checks pass-through.
 */
export const checkPermission = (_permission: string) => {
    return (_req: Request, _res: Response, next: NextFunction) => next()
}

export const checkAnyPermission = (_permissions: string) => {
    return (_req: Request, _res: Response, next: NextFunction) => next()
}
