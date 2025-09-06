import { Request, Response, NextFunction } from 'express'
import { AccountService } from '../../oss/services/account.service'

const accountService = new AccountService()

const registerAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await accountService.registerAccount(req.body)
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
