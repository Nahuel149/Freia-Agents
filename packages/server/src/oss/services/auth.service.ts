import { GeneralSuccessMessage } from '../../utils/constants'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import { getHash, compareHash } from '../utils/encryption.util'

interface LoginBody {
    email: string
    password: string
}

/**
 * AuthService for OSS build.
 * Handles user authentication with database lookup for proper workspace/organization IDs.
 */
export class AuthService {
    public async login(body: LoginBody) {
        const { email, password } = body
        
        // Access the running Express app to retrieve the configured DataSource
        const app = require('../../utils/getRunningExpressApp').getRunningExpressApp()
        const dataSource = app.AppDataSource
        const queryRunner = dataSource.createQueryRunner()
        await queryRunner.connect()
        
        try {
            // Find the user by email
            const userRepo = queryRunner.manager.getRepository(require('../database/entities/user.entity').User)
            const user = await userRepo.findOne({ where: { email } })
            
            if (!user) {
                throw new Error('Invalid email or password')
            }
            
            // Verify password if provided
            if (password && user.credential) {
                const isValidPassword = await compareHash(password, user.credential)
                if (!isValidPassword) {
                    throw new Error('Invalid email or password')
                }
            }
            
            // Get user's workspace information
            const workspaceUserRepo = queryRunner.manager.getRepository(require('../database/entities/workspace-user.entity').WorkspaceUser)
            const workspaceUser = await workspaceUserRepo.findOne({
                where: { userId: user.id },
                relations: ['workspace', 'workspace.organization']
            })
            
            let activeWorkspaceId = user.activeWorkspaceId || 'default-workspace'
            let activeWorkspace = 'Default Workspace'
            let activeOrganizationId = 'default-org'
            
            if (workspaceUser && workspaceUser.workspace) {
                activeWorkspaceId = workspaceUser.workspace.id
                activeWorkspace = workspaceUser.workspace.name
                if (workspaceUser.workspace.organization) {
                    activeOrganizationId = workspaceUser.workspace.organization.id
                }
            }
            
            // Generate a real JWT token with user data
            const tokenPayload = {
                id: user.id,
                email: user.email,
                name: user.name,
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
            
            const token = jwt.sign(
                tokenPayload,
                process.env.FLOWISE_SECRETKEY_OVERWRITE || 'mySecretKey',
                { expiresIn: '24h' }
            )
            
            return {
                message: GeneralSuccessMessage.LOGGED_IN,
                token,
                permissions: [],
                features: [],
                id: user.id,
                email: user.email,
                name: user.name,
                status: 'ACTIVE',
                role: 'admin',
                isSSO: false,
                activeOrganizationId,
                activeOrganizationSubscriptionId: null,
                activeOrganizationCustomerId: null,
                activeOrganizationProductId: null,
                activeWorkspaceId,
                activeWorkspace,
                lastLogin: new Date(),
                isOrganizationAdmin: true,
                assignedWorkspaces: []
            }
        } catch (error) {
            throw error
        } finally {
            await queryRunner.release()
        }
    }
}
