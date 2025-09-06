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
        const { password, ...rest } = body
        // Hash password so that logic matches enterprise flow even if not persisted
        if (password) {
            await getHash(password)
        }
        return {
            message: GeneralSuccessMessage.CREATED,
            user: { ...rest }
        }
    }
}