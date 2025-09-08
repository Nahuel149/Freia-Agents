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
        
        // Complete bypass mode - no validation required
        console.log(`Bypass login for email: ${email}`);
        
        // Generate a bypass token with full admin privileges
        const tokenPayload = {
            id: 'bypass-admin',
            email: email || 'admin@localhost',
            name: 'Bypass Admin',
            roleId: 'super-admin',
            activeOrganizationId: 'bypass-org',
            activeOrganizationSubscriptionId: 'bypass-subscription',
            activeOrganizationCustomerId: 'bypass-customer',
            activeOrganizationProductId: 'bypass-product',
            isOrganizationAdmin: true,
            activeWorkspaceId: 'bypass-workspace',
            activeWorkspace: 'Bypass Workspace',
            assignedWorkspaces: [{ id: 'bypass-workspace', name: 'Bypass Workspace' }],
            isApiKeyValidated: true,
            permissions: ['*'], // All permissions
            features: {} // All features enabled
        }
        
        const token = jwt.sign(
            tokenPayload,
            process.env.FLOWISE_SECRETKEY_OVERWRITE || 'mySecretKey',
            { expiresIn: '24h' }
        )
        
        return {
            message: GeneralSuccessMessage.LOGGED_IN,
            token,
            permissions: ['*'], // All permissions
            features: [], // All features
            id: 'bypass-admin',
            email: email || 'admin@localhost',
            name: 'Bypass Admin',
            status: 'ACTIVE',
            role: 'super-admin',
            isSSO: false,
            activeOrganizationId: 'bypass-org',
            activeOrganizationSubscriptionId: 'bypass-subscription',
            activeOrganizationCustomerId: 'bypass-customer',
            activeOrganizationProductId: 'bypass-product',
            activeWorkspaceId: 'bypass-workspace',
            activeWorkspace: 'Bypass Workspace',
            lastLogin: new Date(),
            isOrganizationAdmin: true,
            assignedWorkspaces: [{ id: 'bypass-workspace', name: 'Bypass Workspace' }]
        }
    }
}
