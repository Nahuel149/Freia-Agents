import { Request, Response, NextFunction } from 'express'
import { AccountService } from '../../oss/services/account.service'

const accountService = new AccountService()

const registerAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Extract user data from request body
        const { user } = req.body
        if (!user) {
            return res.status(400).json({ message: 'User data is required' })
        }
        
        const registerData = {
            name: user.name,
            email: user.email,
            password: user.credential
        }
        
        const result = await accountService.registerAccount(registerData)
        return res.status(201).json(result)
    } catch (error) {
        next(error)
    }
}

const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await accountService.logout()
        return res.status(200).json(result)
    } catch (error) {
        next(error)
    }
}

export default {
    registerAccount,
    logout
}
