import { GeneralSuccessMessage } from '../../utils/constants'
import jwt from 'jsonwebtoken'
import { compareHash } from '../utils/encryption.util'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { WorkspaceUserStatus } from '../database/entities/workspace-user.entity'
import { v4 as uuidv4 } from 'uuid'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

interface LoginBody {
    email: string
    password: string
}

const getSecret = () => process.env.FLOWISE_SECRETKEY_OVERWRITE || 'mySecretKey'
const superAdmins = (process.env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(',').map((e) => e.trim()).filter(Boolean)

export class AuthService {
    private buildToken(payload: any) {
        return jwt.sign(payload, getSecret(), { expiresIn: '24h' })
    }

    private isSuperAdmin(email: string, userType?: string | null) {
        if (userType && userType.toLowerCase() === 'admin') return true
        if (superAdmins.includes(email.toLowerCase())) return true
        return false
    }

    private async ensureWorkspace(userId: string) {
        const app = getRunningExpressApp()
        const ds = app.AppDataSource
        const workspaceRepo = ds.getRepository(require('../database/entities/workspace.entity').Workspace)
        const workspaceUserRepo = ds.getRepository(require('../database/entities/workspace-user.entity').WorkspaceUser)

        // find existing workspace assignment
        const existing = await workspaceUserRepo.findOne({ where: { userId } })
        if (existing) {
            const workspace = await workspaceRepo.findOne({ where: { id: existing.workspaceId as any } })
            return { workspaceId: existing.workspaceId, workspaceName: workspace?.name || 'Workspace' }
        }

        // create personal workspace
        const workspaceId = uuidv4()
        const workspace = workspaceRepo.create({
            id: workspaceId,
            name: 'Personal Workspace',
            organizationId: null
        })
        await workspaceRepo.save(workspace)

        const workspaceUser = workspaceUserRepo.create({
            workspaceId,
            userId,
            roleId: null,
            status: WorkspaceUserStatus.ACTIVE
        })
        await workspaceUserRepo.save(workspaceUser)

        return { workspaceId, workspaceName: workspace.name }
    }

    public async login(body: LoginBody) {
        const email = (body.email || '').toLowerCase().trim()
        const password = body.password || ''

        const app = getRunningExpressApp()
        const ds = app.AppDataSource
        const userRepo = ds.getRepository(require('../database/entities/user.entity').User)
        const user = await userRepo.findOne({ where: { email } })
        if (!user) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Invalid email or password')
        }

        const stored = user.credential || ''
        const isValid = stored ? compareHash(password, stored) || stored === password : false
        if (!isValid) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Invalid email or password')
        }

        // ensure workspace
        let workspaceId = user.activeWorkspaceId || undefined
        let workspaceName = 'Workspace'
        if (!workspaceId) {
            const ensured = await this.ensureWorkspace(user.id)
            workspaceId = ensured.workspaceId
            workspaceName = ensured.workspaceName
            user.activeWorkspaceId = workspaceId
            await userRepo.save(user)
        } else {
            const workspace = await ds.getRepository(require('../database/entities/workspace.entity').Workspace).findOne({
                where: { id: workspaceId as any }
            })
            workspaceName = workspace?.name || workspaceName
        }

        const role = this.isSuperAdmin(email, user.userType) ? 'super-admin' : user.userType || 'user'
        const tokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role,
            activeWorkspaceId: workspaceId,
            activeWorkspace: workspaceName,
            permissions: role === 'super-admin' ? ['*'] : []
        }

        const token = this.buildToken(tokenPayload)

        return {
            message: GeneralSuccessMessage.LOGGED_IN,
            token,
            permissions: tokenPayload.permissions,
            features: [],
            id: user.id,
            email: user.email,
            name: user.name,
            status: 'ACTIVE',
            role,
            isSSO: false,
            activeOrganizationId: null,
            activeWorkspaceId: workspaceId,
            activeWorkspace: workspaceName,
            lastLogin: new Date(),
            isOrganizationAdmin: role === 'super-admin',
            assignedWorkspaces: [{ id: workspaceId, name: workspaceName }]
        }
    }
}
