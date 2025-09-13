import { Request, Response, NextFunction } from 'express'
import { CodeAgent } from '../../database/entities/CodeAgent'
import { CodeAgentExecution, ExecutionStatus } from '../../database/entities/CodeAgentExecution'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { executeCode, CodeLanguage } from '../../utils/codeExecution'
import logger from '../../utils/logger'

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
        const { input, chatHistory } = req.body
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

            // Execute the code
            const result = await executeCode(existingCodeAgent.code, codeLanguage, {
                timeout: 30000,
                environmentVariables: {
                    FLOWISE_INPUT: input || '',
                    FLOWISE_CHAT_HISTORY: JSON.stringify(chatHistory || [])
                }
            })

            // Try to parse output as JSON to extract analytics events
            let parsed
            try {
                parsed = typeof result.output === 'string' ? JSON.parse(result.output) : null
            } catch {}

            // Update execution with result
            savedExecution.output = result.success ? result.output : undefined
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
                status: savedExecution.status
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
                status: 'failed'
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
