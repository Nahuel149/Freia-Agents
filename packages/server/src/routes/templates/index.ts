import express from 'express'
import templatesController from '../../controllers/templates'

const router = express.Router()

router.get('/', templatesController.getTemplates)
router.post('/', templatesController.createTemplate)
router.post('/:id/assign', templatesController.assignTemplate)
router.put('/:id', templatesController.updateTemplate)
router.get('/:slug', templatesController.getTemplateBySlug)

export default router
