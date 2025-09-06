import express from 'express'
import accountController from '../../controllers/account'

const router = express.Router()

// POST /account/register
router.post('/register', accountController.registerAccount)

export default router