import { Request, Response, NextFunction } from 'express'
import { CodeAgent } from '../../database/entities/CodeAgent'
import { CodeAgentExecution, ExecutionStatus } from '../../database/entities/CodeAgentExecution'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { executeCode, CodeLanguage } from '../../utils/codeExecution'
import logger from '../../utils/logger'
import { resolveSelectedStores } from '../../services/documentStoreResolver'

// Create a new CodeAgent
const createCodeAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const { name, description, code, language, isPublic } = req.body

        if (!name || !code || !language) {
            throw new InternalFlowiseError(
                StatusCodes.UNPROCESSABLE_ENTITY,
                'Name, code, and language are required'
            )
        }

        const newCodeAgent = new CodeAgent()
        Object.assign(newCodeAgent, {
            name,
            description: description || '',
            code,
            language,
            isPublic: isPublic || false,
            createdDate: new Date(),
            updatedDate: new Date()
        })

        const codeAgent = appServer.AppDataSource.getRepository(CodeAgent)
        const dbResponse = await codeAgent.save(newCodeAgent)
        return res.status(201).json(dbResponse)
    } catch (error) {
        return next(error)
    }
}

// Get all CodeAgents
const getAllCodeAgents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const codeAgent = appServer.AppDataSource.getRepository(CodeAgent)
        const dbResponse = await codeAgent.find({
            order: {
                updatedDate: 'DESC'
            }
        })
        return res.json(dbResponse)
    } catch (error) {
        return next(error)
    }
}

// Get CodeAgent by ID
const getCodeAgentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const codeAgent = appServer.AppDataSource.getRepository(CodeAgent)
        const dbResponse = await codeAgent.findOne({
            where: {
                id: req.params.id
            }
        })

        if (!dbResponse) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                'CodeAgent not found'
            )
        }

        return res.json(dbResponse)
    } catch (error) {
        return next(error)
    }
}

// Update CodeAgent
const updateCodeAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const { name, description, code, language, isPublic } = req.body
        const codeAgent = appServer.AppDataSource.getRepository(CodeAgent)

        const existingCodeAgent = await codeAgent.findOne({
            where: {
                id: req.params.id
            }
        })

        if (!existingCodeAgent) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                'CodeAgent not found'
            )
        }

        const updateCodeAgent = new CodeAgent()
        Object.assign(updateCodeAgent, {
            ...existingCodeAgent,
            name: name || existingCodeAgent.name,
            description: description !== undefined ? description : existingCodeAgent.description,
            code: code || existingCodeAgent.code,
            language: language || existingCodeAgent.language,
            isPublic: isPublic !== undefined ? isPublic : existingCodeAgent.isPublic,
            updatedDate: new Date()
        })

        const dbResponse = await codeAgent.save(updateCodeAgent)
        return res.json(dbResponse)
    } catch (error) {
        return next(error)
    }
}

// Delete CodeAgent
const deleteCodeAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const codeAgent = appServer.AppDataSource.getRepository(CodeAgent)
        const codeAgentExecution = appServer.AppDataSource.getRepository(CodeAgentExecution)

        const existingCodeAgent = await codeAgent.findOne({
            where: {
                id: req.params.id
            }
        })

        if (!existingCodeAgent) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                'CodeAgent not found'
            )
        }

        // Delete all executions first
        await codeAgentExecution.delete({ codeAgentId: req.params.id })
        
        // Delete the CodeAgent
        await codeAgent.delete(req.params.id)
        
        return res.json({ message: 'CodeAgent deleted successfully' })
    } catch (error) {
        return next(error)
    }
}

// Execute CodeAgent
const executeCodeAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const { input } = req.body
        const chatHistory = (req.body?.context?.chatHistory ?? req.body?.chatHistory) || []
        const codeAgent = appServer.AppDataSource.getRepository(CodeAgent)
        const codeAgentExecution = appServer.AppDataSource.getRepository(CodeAgentExecution)

        const existingCodeAgent = await codeAgent.findOne({
            where: {
                id: req.params.id
            }
        })

        if (!existingCodeAgent) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                'CodeAgent not found'
            )
        }

        // Create execution record
        const newExecution = new CodeAgentExecution()
        Object.assign(newExecution, {
            codeAgentId: req.params.id,
            input: input || '',
            chatHistory: JSON.stringify(chatHistory || []),
            status: 'running',
            startTime: new Date()
        })

        const savedExecution = await codeAgentExecution.save(newExecution)

        try {
            const reqId = (req.headers['x-request-id'] as string) || (req.headers['X-Request-Id'] as string) || ''
            const debugLogs: string[] = []
            const log = (msg: string) => debugLogs.push(`[${new Date().toISOString()}] ${msg}`)

            // Map language string to CodeLanguage enum
            let codeLanguage: CodeLanguage
            switch (existingCodeAgent.language.toLowerCase()) {
                case 'javascript':
                    codeLanguage = CodeLanguage.JAVASCRIPT
                    break
                case 'python':
                    codeLanguage = CodeLanguage.PYTHON
                    break
                case 'typescript':
                    codeLanguage = CodeLanguage.TYPESCRIPT
                    break
                default:
                    throw new Error(`Unsupported language: ${existingCodeAgent.language}`)
            }
            log(`ReqId=${reqId} | Execute agent=${req.params.id} lang=${codeLanguage}`)
            const previewInput = typeof input === 'string' ? input.slice(0, 200) : ''
            log(`Input preview: ${previewInput}`)
            log(`Chat history length: ${Array.isArray(chatHistory) ? chatHistory.length : 0}`)

            // Autoload dataset from selected document IDs (v2) or legacy inline docs
            const autoload: boolean = !!(req.body?.context?.autoload)
            const selectedDocIds: string[] | undefined = req.body?.context?.selectedDocIds
            const legacySelectedDocs = req.body?.context?.selectedDocuments

            let envAutoload: Record<string, string> = {}
            let autoloadSummary: any = undefined

            if (autoload && Array.isArray(selectedDocIds) && selectedDocIds.length > 0) {
                try {
                    const { envelope, totalBytes, datasetHash, statuses, repoRoot } = await resolveSelectedStores(selectedDocIds)
                    envAutoload = {
                        FLOWISE_SELECTED_DOCS: JSON.stringify(envelope),
                        FLOWISE_DATASET_HASH: datasetHash
                    }
                    autoloadSummary = {
                        stores: envelope.stores.length,
                        bytes: totalBytes,
                        datasetHash,
                        statuses
                    }
                    log(`Autoload v2: repoRoot=${repoRoot}`)
                    log(`Autoload v2: ids=${JSON.stringify(selectedDocIds)}`)
                    log(`Autoload v2: stores=${envelope.stores.length}, bytes=${totalBytes}, hash=${datasetHash.slice(0,8)}..., statuses=${JSON.stringify(statuses)}`)
                } catch (e) {
                    logger.warn('Failed to resolve selected stores:', e)
                    log(`Autoload v2 failed: ${(e as Error)?.message || String(e)}`)
                }
            } else if (legacySelectedDocs) {
                envAutoload = { FLOWISE_SELECTED_DOCS: JSON.stringify(legacySelectedDocs) }
                log(`Autoload legacy docs provided`)
            } else {
                log(`No autoload sources present (autoload=${autoload})`)
            }

            // Execute the code
            const result = await executeCode(existingCodeAgent.code, codeLanguage, {
                timeout: 30000,
                workingDirectory: process.cwd(),
                environmentVariables: {
                    FLOWISE_INPUT: input || '',
                    FLOWISE_CHAT_HISTORY: JSON.stringify(chatHistory || []),
                    // Pass through OpenAI and CodeAgent environment variables
                    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
                    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
                    CODEAGENT_MODEL: process.env.CODEAGENT_MODEL || 'gpt-4o-mini',
                    CODEAGENT_TEMPERATURE: process.env.CODEAGENT_TEMPERATURE || '0.2',
                    ...envAutoload
                }
            })
            log(`Execution finished: success=${result.success} timeMs=${result.executionTime}`)
            if (result.error) log(`stderr: ${String(result.error).slice(0, 500)}`)

            // Try to parse output as JSON to extract analytics events
            let parsed
            try {
                parsed = typeof result.output === 'string' ? JSON.parse(result.output) : null
            } catch { parsed = null }
            if (!parsed && typeof result.output === 'string') {
                log(`Raw stdout len=${result.output.length}`)
            }
            if (parsed && parsed.reply) log(`Parsed reply: ${String(parsed.reply).slice(0, 200)}`)

            // Update execution with result
            // Always retain stdout in output so UI can render replies even if there were warnings on stderr
            savedExecution.output = result.output
            savedExecution.error = result.success ? undefined : result.error
            savedExecution.status = result.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED
            savedExecution.endTime = new Date()
            
            await codeAgentExecution.save(savedExecution)

            // Ingest analytics (events, follow-ups, datasets on LOAD_DATA)
            try {
                const { CodeAgentAnalyticsService } = require('../../services/codeagent-analytics')
                const svc = new CodeAgentAnalyticsService(appServer.AppDataSource)

                // If the input is LOAD_DATA with datasets, try to ingest products/clients
                if (typeof input === 'string' && /^\s*LOAD_DATA/i.test(input)) {
                    const jsonPart = String(input).replace(/^\s*LOAD_DATA/i, '').trim()
                    try {
                        const payload = JSON.parse(jsonPart)
                        const products = (payload?.productos?.products) || (payload?.productos?.productos) || payload?.productos || []
                        const clients = (payload?.clientes?.clients) || (payload?.clientes?.clientes) || payload?.clientes || []
                        await svc.ingestDatasets({ products, clients })
                    } catch {}
                }

                if (parsed && parsed.events) {
                    await svc.ingestEvents({ events: parsed.events, agentId: req.params.id })
                }
            } catch (e) {
                logger.warn('Failed to ingest codeagent analytics:', e)
            }

            return res.json({
                executionId: savedExecution.id,
                output: savedExecution.output,
                error: savedExecution.error,
                status: savedExecution.status,
                message: parsed && parsed.reply ? parsed.reply : undefined,
                logs: debugLogs,
                ...(autoloadSummary ? { autoloadSummary } : {})
            })
        } catch (executionError) {
            // Update execution with error
            savedExecution.error = executionError instanceof Error ? executionError.message : String(executionError)
            savedExecution.status = ExecutionStatus.FAILED
            savedExecution.endTime = new Date()
            
            await codeAgentExecution.save(savedExecution)

            logger.error('CodeAgent execution failed:', executionError)
            
            return res.json({
                executionId: savedExecution.id,
                output: null,
                error: executionError instanceof Error ? executionError.message : String(executionError),
                status: 'failed',
                logs: [String(executionError)]
            })
        }
    } catch (error) {
        return next(error)
    }
}

// Get CodeAgent executions
const getCodeAgentExecutions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const codeAgentExecution = appServer.AppDataSource.getRepository(CodeAgentExecution)
        
        const dbResponse = await codeAgentExecution.find({
            where: {
                codeAgentId: req.params.id
            },
            order: {
                startTime: 'DESC'
            }
        })

        return res.json(dbResponse)
    } catch (error) {
        return next(error)
    }
}

export default {
    createCodeAgent,
    getAllCodeAgents,
    getCodeAgentById,
    updateCodeAgent,
    deleteCodeAgent,
    executeCodeAgent,
    getCodeAgentExecutions
}
