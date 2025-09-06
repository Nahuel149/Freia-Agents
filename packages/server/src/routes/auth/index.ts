import express from 'express'
import authController from '../../controllers/auth'

const router = express.Router()

// POST /auth/login
router.post('/login', authController.login)

export default router
