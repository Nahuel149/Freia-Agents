import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../../oss/services/auth.service'

const authService = new AuthService()

const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.login(req.body)
        return res.status(200).json(result)
    } catch (error) {
        next(error)
    }
}

export default {
    login
}
