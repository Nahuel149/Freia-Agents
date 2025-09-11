import { GeneralSuccessMessage } from '../../utils/constants'
import { getHash } from '../utils/encryption.util'

interface RegisterBody {
    name: string
    email: string
    password: string
}

/**
 * Minimal AccountService for OSS build.
 * Handles basic user registration using local database-less approach.
 */
export class AccountService {
    /**
     * Registers a new account. In OSS mode we do not persist data – just mimic success flow.
     */
    public async registerAccount(body: RegisterBody) {
        const { name, email: rawEmail, password } = body
        
        // Validate required fields
        if (!name || typeof name !== 'string') {
            throw new Error('Name is required and must be a string')
        }
        if (!rawEmail || typeof rawEmail !== 'string') {
            throw new Error('Email is required and must be a string')
        }
        if (!password || typeof password !== 'string') {
            throw new Error('Password is required and must be a string')
        }
        
        const email = rawEmail.trim().toLowerCase()
        // Store password as-is or hashed based on preference (OSS mode flexibility)
        const credential = password || undefined

        // Access the running Express app to retrieve the configured DataSource
        const app = require('../../utils/getRunningExpressApp').getRunningExpressApp()
        const dataSource = app.AppDataSource
        const queryRunner = dataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()
        try {
            /* ---------------------------------- User ---------------------------------- */
            const userRepo = queryRunner.manager.getRepository(require('../database/entities/user.entity').User)
            const existingUser = await userRepo
                .createQueryBuilder('user')
                .where('LOWER(user.email) = :email', { email })
                .getOne()
            if (existingUser) {
                throw new Error('Email already registered')
            }
            const user = userRepo.create({ name, email, credential })
            await userRepo.save(user)

            /* --------------------------- Account & Role --------------------------- */
            const AccountEntity = require('../database/entities/account.entity').Account
            const accRepo = queryRunner.manager.getRepository(AccountEntity)
            const account = accRepo.create({ name: `${name}'s Account`, createdBy: user.id })
            await accRepo.save(account)

            const RoleEntity = require('../database/entities/role.entity').Role
            const roleRepo = queryRunner.manager.getRepository(RoleEntity)
            const ownerRole = roleRepo.create({ name: 'owner', permissions: '[]', accountId: account.id })
            await roleRepo.save(ownerRole)

            /* -------------------------------- Workspace -------------------------------- */
            const WorkspaceEntity = require('../database/entities/workspace.entity').Workspace
            const workspaceRepo = queryRunner.manager.getRepository(WorkspaceEntity)
            const workspace = workspaceRepo.create({
                name: 'Personal Workspace',
                createdBy: user.id
            })
            await workspaceRepo.save(workspace)

            /* ------------------------------ WorkspaceUser ------------------------------ */
            const WorkspaceUserEntity = require('../database/entities/workspace-user.entity').WorkspaceUser
            const workspaceUserRepo = queryRunner.manager.getRepository(WorkspaceUserEntity)
            const workspaceUser = workspaceUserRepo.create({
                workspaceId: workspace.id,
                userId: user.id,
                roleId: ownerRole.id,
                status: require('../database/entities/workspace-user.entity').WorkspaceUserStatus.ACTIVE
            })
            await workspaceUserRepo.save(workspaceUser)

            // Update the user with activeWorkspaceId for convenience
            user.activeWorkspaceId = workspace.id
            await userRepo.save(user)

            await queryRunner.commitTransaction()
            return {
                message: GeneralSuccessMessage.CREATED,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    activeWorkspaceId: user.activeWorkspaceId
                }
            }
        } catch (err) {
            await queryRunner.rollbackTransaction()
            throw err
        } finally {
            await queryRunner.release()
        }
    }

    /**
     * Logs out a user. In OSS mode we just return a success message.
     */
    public async logout() {
        return {
            message: 'logged_out',
            redirectUrl: '/signin'
        }
    }
}
