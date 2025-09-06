import { GeneralSuccessMessage } from '../../utils/constants'
import { v4 as uuidv4 } from 'uuid'
import { getHash } from '../utils/encryption.util'

interface LoginBody {
    email: string
    password: string
}

/**
 * Minimal AuthService for OSS build.
 * Generates a dummy token and echoes back user data expected by the UI.
 */
export class AuthService {
    public async login(body: LoginBody) {
        const { email, password } = body
        // Simulate password verification by hashing; no persistence in OSS build
        if (password) {
            await getHash(password)
        }
        return {
            message: GeneralSuccessMessage.LOGGED_IN,
            token: 'dummy-token',
            permissions: [],
            features: [],
            id: uuidv4(),
            email,
            name: email.split('@')[0],
            status: 'ACTIVE',
            role: 'admin',
            isSSO: false,
            activeOrganizationId: 'default-org',
            activeOrganizationSubscriptionId: null,
            activeOrganizationCustomerId: null,
            activeOrganizationProductId: null,
            activeWorkspaceId: 'default-workspace',
            activeWorkspace: 'Default Workspace',
            lastLogin: new Date(),
            isOrganizationAdmin: true,
            assignedWorkspaces: []
        }
    }
}
