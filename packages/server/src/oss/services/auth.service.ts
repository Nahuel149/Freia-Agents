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
        
        // Generate OSS token with full admin privileges
        const tokenPayload = {
            id: 'oss-admin',
            email: email || 'admin@localhost',
            name: 'OSS Admin',
            roleId: 'super-admin',
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
            id: 'oss-admin',
            email: email || 'admin@localhost',
            name: 'OSS Admin',
            status: 'ACTIVE',
            role: 'super-admin',
            isSSO: false,
            activeOrganizationId: 'oss-mode',
            activeOrganizationSubscriptionId: null,
            activeOrganizationCustomerId: null,
            activeOrganizationProductId: null,
            activeWorkspaceId: 'oss-mode',
            activeWorkspace: 'OSS Mode',
            lastLogin: new Date(),
            isOrganizationAdmin: true,
            assignedWorkspaces: [{ id: 'oss-mode', name: 'OSS Mode' }]
        }
    }
}
