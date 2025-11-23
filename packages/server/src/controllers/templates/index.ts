import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import templatesService from '../../services/templates'

const getUserContext = (req: Request) => {
    const headerRole = Array.isArray(req.headers['x-user-role'])
        ? req.headers['x-user-role'][0]
        : (req.headers['x-user-role'] as string | undefined)
    const headerUserId = Array.isArray(req.headers['x-user-id'])
        ? req.headers['x-user-id'][0]
        : (req.headers['x-user-id'] as string | undefined)
    const headerWorkspaceId = Array.isArray(req.headers['x-workspace-id'])
        ? req.headers['x-workspace-id'][0]
        : (req.headers['x-workspace-id'] as string | undefined)

    return {
        ...req.user,
        role: (req.user as any)?.role || (req.user as any)?.roleId || headerRole,
        roleId: (req.user as any)?.roleId || headerRole,
        id: req.user?.id || headerUserId,
        activeWorkspaceId: (req.user as any)?.activeWorkspaceId || headerWorkspaceId
    }
}

const getTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const templates = await templatesService.getTemplates(getUserContext(req))
        return res.json({ templates })
    } catch (error) {
        next(error)
    }
}

const getTemplateBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const slug = req.params?.slug
        if (!slug) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Slug requerido')
        const template = await templatesService.getTemplateBySlug(slug, getUserContext(req))
        return res.json({ template })
    } catch (error) {
        next(error)
    }
}

const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Body requerido')
        const template = await templatesService.createTemplate(req.body, getUserContext(req))
        return res.status(StatusCodes.CREATED).json({ template })
    } catch (error) {
        next(error)
    }
}

const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params?.id
        if (!id) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Id requerido')
        const template = await templatesService.updateTemplate(id, req.body || {}, getUserContext(req))
        return res.json({ template })
    } catch (error) {
        next(error)
    }
}

const assignTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params?.id
        if (!id) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Id requerido')
        const assignment = await templatesService.assignTemplate(id, req.body || {}, getUserContext(req))
        return res.json({ assignment })
    } catch (error) {
        next(error)
    }
}

export default {
    getTemplates,
    getTemplateBySlug,
    createTemplate,
    updateTemplate,
    assignTemplate
}
