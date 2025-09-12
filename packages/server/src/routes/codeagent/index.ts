import express from 'express'
import codeAgentController from './codeAgentController'
import { checkPermission, checkAnyPermission } from '../../oss/rbac/PermissionCheck'

const router = express.Router()

// CRUD operations for CodeAgent
router.post('/', checkPermission('codeagents:create'), codeAgentController.createCodeAgent)
router.get('/', checkPermission('codeagents:view'), codeAgentController.getAllCodeAgents)
router.get(['/', '/:id'], checkPermission('codeagents:view'), codeAgentController.getCodeAgentById)
router.put(['/', '/:id'], checkAnyPermission('codeagents:create,codeagents:update'), codeAgentController.updateCodeAgent)
router.delete(['/', '/:id'], checkPermission('codeagents:delete'), codeAgentController.deleteCodeAgent)

// Execution operations
router.post('/execute/:id', checkPermission('codeagents:execute'), codeAgentController.executeCodeAgent)
router.get('/executions/:id', checkPermission('codeagents:view'), codeAgentController.getCodeAgentExecutions)

export default router