import { In } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { LandingTemplate } from '../../database/entities/LandingTemplate'
import { UserTemplate } from '../../database/entities/UserTemplate'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { LoggedInUser } from '../../oss/Interface'

type AuthContext = {
    userId?: string
    workspaceId?: string
    isSuperAdmin: boolean
}

type TemplatePayload = {
    slug: string
    name?: string
    config?: any
    ownerWorkspaceId?: string | null
}

type AssignmentPayload = {
    userIds?: string[]
    workspaceIds?: string[]
}

const normalizeConfig = (config: any): Record<string, any> => {
    if (!config) return {}
    if (typeof config === 'string') {
        try {
            return JSON.parse(config)
        } catch {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'El config debe ser JSON válido')
        }
    }
    if (typeof config === 'object') return config
    return {}
}

const sanitizeSlug = (slug?: string) => {
    const value = (slug || '').trim()
    if (!value) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Falta el slug de la template')
    }
    return value.toLowerCase()
}

const resolveAuthContext = (user?: LoggedInUser): AuthContext => {
    if (!user) {
        throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Unauthorized')
    }
    const role = (user as any).roleId || (user as any).role
    const permissions = Array.isArray(user.permissions) ? user.permissions : []
    const isSuperAdmin = role === 'super-admin' || role === 'super_admin' || permissions.includes('*')
    const workspaceId = (user as any).activeWorkspaceId || (user as any).workspaceId || null

    return {
        userId: (user as any).id,
        workspaceId: workspaceId || undefined,
        isSuperAdmin
    }
}

const mapTemplate = (template: LandingTemplate) => {
    return {
        id: template.id,
        slug: template.slug,
        name: template.name,
        config: normalizeConfig(template.config),
        ownerWorkspaceId: template.ownerWorkspaceId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
    }
}

const fetchTemplatesForContext = async (context: AuthContext) => {
    const appServer = getRunningExpressApp()
    const templateRepo = appServer.AppDataSource.getRepository(LandingTemplate)

    if (context.isSuperAdmin) {
        const templates = await templateRepo.find()
        return templates
    }

    const assignmentRepo = appServer.AppDataSource.getRepository(UserTemplate)
    const templateIds = new Set<string>()

    if (context.userId) {
        const userAssignments = await assignmentRepo.find({ where: { userId: context.userId } })
        userAssignments.forEach((assignment) => templateIds.add(assignment.templateId))
    }

    if (context.workspaceId) {
        const workspaceAssignments = await assignmentRepo.find({ where: { workspaceId: context.workspaceId } })
        workspaceAssignments.forEach((assignment) => templateIds.add(assignment.templateId))
    }

    const where: any[] = []
    if (templateIds.size) {
        where.push({ id: In([...templateIds]) })
    }
    if (context.workspaceId) {
        where.push({ ownerWorkspaceId: context.workspaceId })
    }

    if (!where.length) return []

    const templates = await templateRepo.find({ where })
    const deduped = new Map<string, LandingTemplate>()
    templates.forEach((template) => deduped.set(template.id, template))
    return Array.from(deduped.values())
}

const getTemplates = async (user?: LoggedInUser) => {
    const context = resolveAuthContext(user)
    const templates = await fetchTemplatesForContext(context)
    return templates.map(mapTemplate)
}

const getTemplateBySlug = async (slug: string, user?: LoggedInUser) => {
    const context = resolveAuthContext(user)
    const targetSlug = sanitizeSlug(slug)
    const templates = await fetchTemplatesForContext(context)

    const match = templates.find((template) => {
        if (template.slug === targetSlug) return true
        const config = normalizeConfig(template.config)
        const aliases: string[] = Array.isArray(config.aliases) ? config.aliases : []
        return aliases.map((alias) => alias.toString().toLowerCase()).includes(targetSlug)
    })

    if (!match) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Template no encontrada o no asignada')
    }

    return mapTemplate(match)
}

const createTemplate = async (payload: TemplatePayload, user?: LoggedInUser) => {
    const context = resolveAuthContext(user)
    if (!context.isSuperAdmin) {
        throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Solo un super_admin puede crear templates')
    }

    const slug = sanitizeSlug(payload.slug)
    const appServer = getRunningExpressApp()
    const templateRepo = appServer.AppDataSource.getRepository(LandingTemplate)

    const existing = await templateRepo.findOne({ where: { slug } })
    if (existing) {
        throw new InternalFlowiseError(StatusCodes.CONFLICT, 'El slug de la template ya existe')
    }

    const template = templateRepo.create({
        slug,
        name: payload.name?.trim() || slug,
        config: normalizeConfig(payload.config),
        ownerWorkspaceId: payload.ownerWorkspaceId ?? context.workspaceId ?? null
    })

    const saved = await templateRepo.save(template)
    return mapTemplate(saved)
}

const updateTemplate = async (identifier: string, payload: TemplatePayload, user?: LoggedInUser) => {
    const context = resolveAuthContext(user)
    if (!context.isSuperAdmin) {
        throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Solo un super_admin puede editar templates')
    }

    const appServer = getRunningExpressApp()
    const templateRepo = appServer.AppDataSource.getRepository(LandingTemplate)

    const template = await templateRepo.findOne({
        where: [{ id: identifier }, { slug: identifier }]
    })

    if (!template) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Template no encontrada')
    }

    if (payload.slug) {
        const nextSlug = sanitizeSlug(payload.slug)
        if (nextSlug !== template.slug) {
            const existing = await templateRepo.findOne({ where: { slug: nextSlug } })
            if (existing) {
                throw new InternalFlowiseError(StatusCodes.CONFLICT, 'Ya existe una template con ese slug')
            }
            template.slug = nextSlug
        }
    }

    if (payload.name) template.name = payload.name.trim()
    if (payload.config !== undefined) template.config = normalizeConfig(payload.config)
    if (payload.ownerWorkspaceId !== undefined) template.ownerWorkspaceId = payload.ownerWorkspaceId

    const saved = await templateRepo.save(template)
    return mapTemplate(saved)
}

const assignTemplate = async (identifier: string, payload: AssignmentPayload, user?: LoggedInUser) => {
    const context = resolveAuthContext(user)
    if (!context.isSuperAdmin) {
        throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Solo un super_admin puede asignar templates')
    }

    const appServer = getRunningExpressApp()
    const templateRepo = appServer.AppDataSource.getRepository(LandingTemplate)
    const assignmentRepo = appServer.AppDataSource.getRepository(UserTemplate)

    const template = await templateRepo.findOne({
        where: [{ id: identifier }, { slug: identifier }]
    })

    if (!template) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Template no encontrada')
    }

    const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : []
    const workspaceIds = Array.isArray(payload.workspaceIds) ? payload.workspaceIds.filter(Boolean) : []

    if (!userIds.length && !workspaceIds.length) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Debes enviar al menos un usuario o workspace')
    }

    const records: Partial<UserTemplate>[] = [
        ...userIds.map((userId) => ({ userId, templateId: template.id })),
        ...workspaceIds.map((workspaceId) => ({ workspaceId, templateId: template.id }))
    ]

    await assignmentRepo.createQueryBuilder().insert().values(records).orIgnore().execute()

    return {
        templateId: template.id,
        assignedUsers: userIds.length,
        assignedWorkspaces: workspaceIds.length
    }
}

export default {
    getTemplates,
    getTemplateBySlug,
    createTemplate,
    updateTemplate,
    assignTemplate
}
