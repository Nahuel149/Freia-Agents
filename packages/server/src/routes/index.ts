import express from 'express'
import apikeyRouter from './apikey'
import assistantsRouter from './assistants'
import attachmentsRouter from './attachments'
import chatMessageRouter from './chat-messages'
import chatflowsRouter from './chatflows'
import chatflowsStreamingRouter from './chatflows-streaming'
import chatflowsUploadsRouter from './chatflows-uploads'
import codeAgentRouter from './codeagent'
import codeOrchestrationRouter from './code-orchestration'
import componentsCredentialsRouter from './components-credentials'
import componentsCredentialsIconRouter from './components-credentials-icon'
import credentialsRouter from './credentials'
import datasetRouter from './dataset'
import documentStoreRouter from './documentstore'
import evaluationsRouter from './evaluations'
import evaluatorsRouter from './evaluator'
import exportImportRouter from './export-import'
import feedbackRouter from './feedback'
import fetchLinksRouter from './fetch-links'
import filesRouter from './files'
import flowConfigRouter from './flow-config'
import getUploadFileRouter from './get-upload-file'
import getUploadPathRouter from './get-upload-path'
import internalChatmessagesRouter from './internal-chat-messages'
import internalPredictionRouter from './internal-predictions'
import leadsRouter from './leads'
import loadPromptRouter from './load-prompts'
import logsRouter from './log'
import loginmethodRouter from './loginmethod'
import marketplacesRouter from './marketplaces'
import nodeConfigRouter from './node-configs'
import nodeCustomFunctionRouter from './node-custom-functions'
import nodeIconRouter from './node-icons'
import nodeLoadMethodRouter from './node-load-methods'
import nodesRouter from './nodes'
import oauth2Router from './oauth2'
import openaiAssistantsRouter from './openai-assistants'
import openaiAssistantsFileRouter from './openai-assistants-files'
import openaiAssistantsVectorStoreRouter from './openai-assistants-vector-store'
import openaiRealtimeRouter from './openai-realtime'
import pingRouter from './ping'
import authRouter from './auth'
import accountRouter from './account'
import predictionRouter from './predictions'
import promptListsRouter from './prompts-lists'
import publicChatbotRouter from './public-chatbots'
import publicChatflowsRouter from './public-chatflows'
import publicExecutionsRouter from './public-executions'
import settingsRouter from './settings'
import statsRouter from './stats'
import toolsRouter from './tools'
import upsertHistoryRouter from './upsert-history'
import variablesRouter from './variables'
import vectorRouter from './vectors'
import verifyRouter from './verify'
import versionRouter from './versions'
import pricingRouter from './pricing'
import nvidiaNimRouter from './nvidia-nim'
import executionsRouter from './executions'
import validationRouter from './validation'
import agentflowv2GeneratorRouter from './agentflowv2-generator'
import dashboardRouter from './dashboard'
import agentDashboardRouter from './agent-dashboard'
import userRouter from './user'
import codeAgentAnalyticsRouter from './codeagent-analytics'
import whatsappRouter from './whatsapp'
import supportRouter from './support'
import inventoryRouter from './inventory'
import notificationsRouter from './notifications'
import promotionsRouter from './promotions'
import customersRouter from './customers'
import salesRouter from './sales'
import followupRouter from './followup'
import followupsRouter from './followups'
import templatesRouter from './templates'

import { IdentityManager } from '../IdentityManager'

const router = express.Router()

router.use('/ping', pingRouter)
router.use('/apikey', apikeyRouter)
router.use('/assistants', assistantsRouter)
router.use('/attachments', attachmentsRouter)
router.use('/chatflows', chatflowsRouter)
router.use('/chatflows-streaming', chatflowsStreamingRouter)
router.use('/chatmessage', chatMessageRouter)
router.use('/codeagent', codeAgentRouter)
router.use('/codeagent-orchestration', codeOrchestrationRouter)
router.use('/chatflows-uploads', chatflowsUploadsRouter)
router.use('/components-credentials', componentsCredentialsRouter)
router.use('/components-credentials-icon', componentsCredentialsIconRouter)
router.use('/credentials', credentialsRouter)
router.use('/datasets', datasetRouter)
router.use('/document-store', documentStoreRouter)
router.use('/evaluations', evaluationsRouter)
router.use('/evaluators', evaluatorsRouter)
router.use('/export-import', exportImportRouter)
router.use('/feedback', feedbackRouter)
router.use('/fetch-links', fetchLinksRouter)
router.use('/flow-config', flowConfigRouter)
router.use('/internal-chatmessage', internalChatmessagesRouter)
router.use('/internal-prediction', internalPredictionRouter)
router.use('/get-upload-file', getUploadFileRouter)
router.use('/get-upload-path', getUploadPathRouter)
router.use('/leads', leadsRouter)
router.use('/load-prompt', loadPromptRouter)
router.use('/marketplaces', marketplacesRouter)
router.use('/node-config', nodeConfigRouter)
router.use('/node-custom-function', nodeCustomFunctionRouter)
router.use('/node-icon', nodeIconRouter)
router.use('/node-load-method', nodeLoadMethodRouter)
router.use('/nodes', nodesRouter)
router.use('/oauth2-credential', oauth2Router)
router.use('/openai-assistants', openaiAssistantsRouter)
router.use('/openai-assistants-file', openaiAssistantsFileRouter)
router.use('/openai-assistants-vector-store', openaiAssistantsVectorStoreRouter)
router.use('/openai-realtime', openaiRealtimeRouter)
router.use('/prediction', predictionRouter)
router.use('/prompts-list', promptListsRouter)
router.use('/public-chatbotConfig', publicChatbotRouter)
router.use('/public-chatflows', publicChatflowsRouter)
router.use('/public-executions', publicExecutionsRouter)
router.use('/stats', statsRouter)
router.use('/tools', toolsRouter)
router.use('/variables', variablesRouter)
router.use('/vector', vectorRouter)
router.use('/verify', verifyRouter)
router.use('/account', accountRouter)
router.use('/auth', authRouter)
router.use('/version', versionRouter)
router.use('/upsert-history', upsertHistoryRouter)
router.use('/settings', settingsRouter)
// Alias to avoid ad-blockers blocking '/settings'
router.use('/app-settings', settingsRouter)
router.use('/pricing', pricingRouter)
router.use('/nvidia-nim', nvidiaNimRouter)
router.use('/executions', executionsRouter)
router.use('/validation', validationRouter)
router.use('/agentflowv2-generator', agentflowv2GeneratorRouter)
router.use('/dashboard', dashboardRouter)
router.use('/agent-dashboard', agentDashboardRouter)
router.use('/user', userRouter)
router.use('/codeagent-analytics', codeAgentAnalyticsRouter)
router.use('/whatsapp', whatsappRouter)
router.use('/support', supportRouter)
router.use('/inventory', inventoryRouter)
router.use('/notifications', notificationsRouter)
router.use('/customers', customersRouter)
router.use('/sales', salesRouter)
router.use('/promotions', promotionsRouter)
router.use('/followup', followupRouter)
router.use('/followups', followupsRouter)
router.use('/templates', templatesRouter)

router.use('/loginmethod', loginmethodRouter)
router.use('/logs', IdentityManager.checkFeatureByPlan('feat:logs'), logsRouter)
router.use('/files', IdentityManager.checkFeatureByPlan('feat:files'), filesRouter)

// Minimal OSS user test endpoint for compatibility with tests
router.get('/user/test', (_req, res) => {
    return res.json({ message: 'Hello World' })
})

export default router
