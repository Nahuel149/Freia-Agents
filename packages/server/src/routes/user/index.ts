import express from 'express'
import userController from '../../controllers/user'

const router = express.Router()

router.get('/', userController.getUser)
router.put('/', userController.updateUser)

export default router
