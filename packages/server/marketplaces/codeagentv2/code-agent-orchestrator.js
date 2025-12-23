const { Pool } = require('pg')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')

/**
 * CodeAgent Orchestrator - Main orchestration system for code generation and development tasks
 * Adapted from B2B Sales Agent architecture for code-related workflows
 */
class CodeAgentOrchestrator {
    constructor(config = {}) {
        // Database configuration
        this.dbConfig = {
            host: config.dbHost || process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
            port: config.dbPort || process.env.DB_PORT || process.env.DATABASE_PORT || 5432,
            database: config.dbName || process.env.DB_NAME || process.env.DATABASE_NAME || 'freia_postgres',
            user: config.dbUser || process.env.DB_USER || process.env.DATABASE_USER || 'postgres',
            password: config.dbPassword || process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || 'password',
            ssl:
                process.env.DATABASE_SSL === 'true'
                    ? {
                          rejectUnauthorized: false
                      }
                    : false
        }

        this.pool = new Pool(this.dbConfig)

        // API Configuration
        this.flowiseApiUrl = config.flowiseApiUrl || process.env.FLOWISE_API_URL || 'http://localhost:3000'
        this.codeAgentApiUrl = config.codeAgentApiUrl || process.env.CODE_AGENT_API_URL || 'http://localhost:8080'

        // Agent Configuration
        this.maxRetries = config.maxRetries || 3
        this.defaultTimeout = config.defaultTimeout || 30000
        this.qualityThreshold = config.qualityThreshold || 7.0

        // Components
        this.agentDefinitions = null
        this.followUpSystem = null
        this.codeAnalyzer = null

        // State
        this.isInitialized = false
        this.activeSessions = new Map()

        console.log('CodeAgent Orchestrator initialized with config:', {
            database: this.dbConfig.database,
            host: this.dbConfig.host,
            flowiseUrl: this.flowiseApiUrl,
            codeAgentUrl: this.codeAgentApiUrl
        })
    }

    /**
     * Initialize the orchestrator and all its components
     */
    async initialize() {
        try {
            console.log('Initializing CodeAgent Orchestrator...')

            // Test database connection
            await this.testDatabaseConnection()

            // Initialize components
            const { CodeAgentDefinitions } = require('./code-agent-definitions')
            const { CodeFollowUpSystem } = require('./code-followup-system')
            const { CodeAnalyzer } = require('./code-analyzer')

            this.agentDefinitions = new CodeAgentDefinitions(this.pool)
            this.followUpSystem = new CodeFollowUpSystem(this.pool)
            this.codeAnalyzer = new CodeAnalyzer(this.pool)

            await this.agentDefinitions.initialize()
            await this.followUpSystem.initialize()
            await this.codeAnalyzer.initialize()

            this.isInitialized = true
            console.log('CodeAgent Orchestrator initialized successfully')
        } catch (error) {
            console.error('Failed to initialize CodeAgent Orchestrator:', error)
            throw error
        }
    }

    /**
     * Process a code development request from user
     */
    async processCodeRequest(requestData) {
        try {
            if (!this.isInitialized) {
                throw new Error('Orchestrator not initialized')
            }

            console.log('Processing code request:', requestData)

            // Create or get session
            const session = await this.createOrGetSession(requestData)

            // Create agent execution plan
            const agentPlan = await this.createAgentPlan(session, requestData)

            // Execute agents sequentially
            const results = await this.executeAgentsSequentially(session, agentPlan, requestData)

            // Process final result
            const finalResult = await this.processFinalResult(session, results)

            // Schedule follow-ups if needed
            await this.scheduleFollowUps(session, finalResult)

            return finalResult
        } catch (error) {
            console.error('Error processing code request:', error)
            throw error
        }
    }

    /**
     * Create or retrieve existing session
     */
    async createOrGetSession(requestData) {
        try {
            let session

            if (requestData.sessionId) {
                // Try to get existing session
                const query = 'SELECT * FROM code_sessions WHERE session_id = $1'
                const result = await this.pool.query(query, [requestData.sessionId])

                if (result.rows.length > 0) {
                    session = result.rows[0]
                    // Update last activity
                    await this.pool.query('UPDATE code_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [session.id])
                } else {
                    throw new Error(`Session ${requestData.sessionId} not found`)
                }
            } else {
                // Create new session
                const sessionId = uuidv4()
                const insertQuery = `
                    INSERT INTO code_sessions (
                        session_id, user_id, project_name, project_description,
                        programming_language, framework, complexity_level, session_context
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *
                `

                const values = [
                    sessionId,
                    requestData.userId || null,
                    requestData.projectName || 'Untitled Project',
                    requestData.projectDescription || '',
                    requestData.programmingLanguage || 'javascript',
                    requestData.framework || null,
                    requestData.complexityLevel || 'medium',
                    JSON.stringify(requestData.context || {})
                ]

                const result = await this.pool.query(insertQuery, values)
                session = result.rows[0]

                console.log('Created new session:', session.session_id)
            }

            // Store in active sessions
            this.activeSessions.set(session.session_id, session)

            return session
        } catch (error) {
            console.error('Error creating/getting session:', error)
            throw error
        }
    }

    /**
     * Create execution plan based on request and session context
     */
    async createAgentPlan(session, requestData) {
        try {
            const taskType = requestData.taskType || 'generation'
            const complexity = session.complexity_level
            const language = session.programming_language

            // Get appropriate agents for this task
            const agents = await this.agentDefinitions.getAgentsForTask(taskType, complexity, language)

            // Create execution plan
            const plan = {
                sessionId: session.session_id,
                taskType,
                agents: agents.map((agent) => ({
                    ...agent,
                    executionOrder: agent.priority,
                    timeout: agent.timeout || this.defaultTimeout,
                    retries: 0,
                    maxRetries: this.maxRetries
                })),
                estimatedDuration: this.calculateEstimatedDuration(agents),
                createdAt: new Date()
            }

            console.log('Created agent plan:', {
                sessionId: plan.sessionId,
                taskType: plan.taskType,
                agentCount: plan.agents.length,
                estimatedDuration: plan.estimatedDuration
            })

            return plan
        } catch (error) {
            console.error('Error creating agent plan:', error)
            throw error
        }
    }

    /**
     * Execute agents in sequence according to the plan
     */
    async executeAgentsSequentially(session, plan, requestData) {
        const results = []
        let previousResult = null

        try {
            for (const agent of plan.agents) {
                console.log(`Executing agent: ${agent.name} (${agent.type})`)

                // Create task record
                const task = await this.createTaskRecord(session, agent, requestData)

                // Execute agent with context
                const agentResult = await this.executeAgent(agent, {
                    session,
                    task,
                    requestData,
                    previousResult,
                    context: this.buildAgentContext(session, previousResult)
                })

                // Update task with result
                await this.updateTaskResult(task.id, agentResult)

                // Log interaction
                await this.logAgentInteraction(session, task, agent, agentResult)

                results.push({
                    agent: agent.name,
                    type: agent.type,
                    result: agentResult,
                    taskId: task.id,
                    executionTime: agentResult.executionTime
                })

                previousResult = agentResult

                // Check if we should continue based on result quality
                if (agentResult.shouldStop) {
                    console.log('Agent execution stopped early due to result condition')
                    break
                }
            }

            return results
        } catch (error) {
            console.error('Error executing agents:', error)
            throw error
        }
    }

    /**
     * Execute individual agent
     */
    async executeAgent(agent, context) {
        const startTime = Date.now()
        let attempt = 0

        while (attempt < agent.maxRetries) {
            try {
                console.log(`Executing ${agent.name}, attempt ${attempt + 1}`)

                // Prepare agent input
                const agentInput = this.prepareAgentInput(agent, context)

                // Call agent API (Flowise or direct CodeAgent)
                let result
                if (agent.apiType === 'flowise') {
                    result = await this.callFlowiseAgent(agent, agentInput)
                } else {
                    result = await this.callCodeAgent(agent, agentInput)
                }

                // Analyze result quality
                const qualityScore = await this.analyzeResultQuality(result, agent.type)

                const executionTime = Date.now() - startTime

                return {
                    success: true,
                    data: result,
                    qualityScore,
                    executionTime,
                    attempt: attempt + 1,
                    shouldStop: qualityScore < this.qualityThreshold && attempt === agent.maxRetries - 1
                }
            } catch (error) {
                attempt++
                console.error(`Agent ${agent.name} failed on attempt ${attempt}:`, error.message)

                if (attempt >= agent.maxRetries) {
                    return {
                        success: false,
                        error: error.message,
                        executionTime: Date.now() - startTime,
                        attempt,
                        shouldStop: true
                    }
                }

                // Wait before retry
                await this.sleep(1000 * attempt)
            }
        }
    }

    /**
     * Process final result and prepare response
     */
    async processFinalResult(session, results) {
        try {
            const successfulResults = results.filter((r) => r.result.success)
            const failedResults = results.filter((r) => !r.result.success)

            // Combine all generated code
            const generatedCode = successfulResults
                .map((r) => r.result.data?.code || r.result.data?.content)
                .filter((code) => code)
                .join('\n\n')

            // Calculate overall quality score
            const qualityScores = successfulResults.map((r) => r.result.qualityScore).filter((s) => s)
            const averageQuality = qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0

            // Update session phase
            await this.updateSessionPhase(session, 'completed')

            const finalResult = {
                sessionId: session.session_id,
                success: successfulResults.length > 0,
                generatedCode,
                qualityScore: averageQuality,
                executionSummary: {
                    totalAgents: results.length,
                    successfulAgents: successfulResults.length,
                    failedAgents: failedResults.length,
                    totalExecutionTime: results.reduce((sum, r) => sum + (r.result.executionTime || 0), 0)
                },
                results: successfulResults.map((r) => ({
                    agent: r.agent,
                    type: r.type,
                    code: r.result.data?.code,
                    explanation: r.result.data?.explanation,
                    qualityScore: r.result.qualityScore
                })),
                errors: failedResults.map((r) => ({
                    agent: r.agent,
                    error: r.result.error
                })),
                recommendations: await this.generateRecommendations(session, results),
                timestamp: new Date()
            }

            console.log('Final result processed:', {
                sessionId: finalResult.sessionId,
                success: finalResult.success,
                qualityScore: finalResult.qualityScore,
                codeLength: generatedCode?.length || 0
            })

            return finalResult
        } catch (error) {
            console.error('Error processing final result:', error)
            throw error
        }
    }

    /**
     * Schedule follow-up tasks based on result analysis
     */
    async scheduleFollowUps(session, finalResult) {
        try {
            if (!finalResult.success) {
                // Schedule debugging follow-up
                await this.followUpSystem.scheduleFollowUp({
                    sessionId: session.id,
                    type: 'bug_fix',
                    priority: 'high',
                    scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
                    context: { errors: finalResult.errors }
                })
            } else if (finalResult.qualityScore < this.qualityThreshold) {
                // Schedule optimization follow-up
                await this.followUpSystem.scheduleFollowUp({
                    sessionId: session.id,
                    type: 'optimization_suggestion',
                    priority: 'medium',
                    scheduledAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
                    context: { qualityScore: finalResult.qualityScore }
                })
            } else {
                // Schedule code review follow-up
                await this.followUpSystem.scheduleFollowUp({
                    sessionId: session.id,
                    type: 'code_review',
                    priority: 'low',
                    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                    context: { generatedCode: finalResult.generatedCode }
                })
            }
        } catch (error) {
            console.error('Error scheduling follow-ups:', error)
            // Don't throw - follow-ups are not critical
        }
    }

    // Helper methods
    async testDatabaseConnection() {
        try {
            const result = await this.pool.query('SELECT NOW()')
            console.log('Database connection successful:', result.rows[0].now)
        } catch (error) {
            console.error('Database connection failed:', error)
            throw error
        }
    }

    calculateEstimatedDuration(agents) {
        return agents.reduce((total, agent) => total + (agent.estimatedDuration || 10000), 0)
    }

    buildAgentContext(session, previousResult) {
        return {
            sessionContext: JSON.parse(session.session_context || '{}'),
            previousResult: previousResult?.data,
            language: session.programming_language,
            framework: session.framework,
            complexity: session.complexity_level
        }
    }

    async createTaskRecord(session, agent, requestData) {
        const query = `
            INSERT INTO code_tasks (
                session_id, code_agent_id, task_type, task_description,
                input_requirements, programming_language, framework,
                complexity_score, execution_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `

        const values = [
            session.id,
            agent.id,
            agent.type,
            requestData.description || agent.description,
            JSON.stringify(requestData),
            session.programming_language,
            session.framework,
            this.getComplexityScore(session.complexity_level),
            'running'
        ]

        const result = await this.pool.query(query, values)
        return result.rows[0]
    }

    async updateTaskResult(taskId, result) {
        const query = `
            UPDATE code_tasks SET
                generated_code = $1,
                execution_status = $2,
                execution_time_ms = $3,
                error_message = $4,
                quality_score = $5,
                agent_confidence = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
        `

        const values = [
            result.data?.code || null,
            result.success ? 'completed' : 'failed',
            result.executionTime,
            result.error || null,
            result.qualityScore || null,
            result.data?.confidence || null,
            taskId
        ]

        await this.pool.query(query, values)
    }

    async logAgentInteraction(session, task, agent, result) {
        const query = `
            INSERT INTO agent_interactions (
                session_id, task_id, agent_type, interaction_type,
                message_content, code_snippet, metadata, response_time_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `

        const values = [
            session.id,
            task.id,
            agent.type,
            result.success ? 'code_generation' : 'error_handling',
            result.data?.explanation || result.error || 'No message',
            result.data?.code || null,
            JSON.stringify({ agent: agent.name, attempt: result.attempt }),
            result.executionTime
        ]

        await this.pool.query(query, values)
    }

    async updateSessionPhase(session, phase) {
        await this.pool.query('UPDATE code_sessions SET current_phase = $1 WHERE id = $2', [phase, session.id])
    }

    getComplexityScore(level) {
        const scores = { simple: 3, medium: 5, complex: 7, enterprise: 9 }
        return scores[level] || 5
    }

    async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Get available document stores for selection
     */
    async getAvailableDocumentStores() {
        try {
            const query = `
                SELECT id, name, description, status, created_date
                FROM "DocumentStore"
                WHERE status = 'SYNC'
                ORDER BY created_date DESC
            `

            const result = await this.pool.query(query)
            return result.rows
        } catch (error) {
            console.error('Error fetching document stores:', error)
            throw error
        }
    }

    /**
     * Get document loaders for a specific document store
     */
    async getDocumentLoaders(documentStoreId) {
        try {
            const query = `
                SELECT id, loader_name, source, status, config
                FROM "DocumentStoreFileChunk"
                WHERE "docId" = $1
                GROUP BY id, loader_name, source, status, config
                ORDER BY id DESC
            `

            const result = await this.pool.query(query, [documentStoreId])
            return result.rows
        } catch (error) {
            console.error('Error fetching document loaders:', error)
            throw error
        }
    }

    /**
     * Query document store for relevant content
     */
    async queryDocumentStore(documentStoreId, query, options = {}) {
        try {
            const { limit = 5, threshold = 0.7 } = options

            // Use the document store API to perform similarity search
            const searchQuery = `
                SELECT 
                    id,
                    "pageContent",
                    metadata,
                    source,
                    1 - (embedding <=> $2::vector) as similarity
                FROM "DocumentStoreFileChunk"
                WHERE "docId" = $1
                    AND 1 - (embedding <=> $2::vector) > $3
                ORDER BY similarity DESC
                LIMIT $4
            `

            // For now, return mock data since we need embedding generation
            // In a full implementation, you'd generate embeddings for the query
            const mockResults = {
                documents: [],
                sources: [],
                links: []
            }

            return mockResults
        } catch (error) {
            console.error('Error querying document store:', error)
            throw error
        }
    }

    /**
     * Process code request with document context
     */
    async processCodeRequestWithDocuments(request) {
        try {
            const { documentStoreId, query, codeRequest } = request

            // Get relevant documents
            const documentContext = await this.queryDocumentStore(documentStoreId, query)

            // Enhance the code request with document context
            const enhancedRequest = {
                ...codeRequest,
                context: {
                    documents: documentContext.documents,
                    sources: documentContext.sources
                }
            }

            // Process the enhanced request
            const result = await this.processCodeRequest(enhancedRequest)

            // Add source links to the result
            result.sourceDocuments = documentContext.documents
            result.sourceLinks = documentContext.links

            return result
        } catch (error) {
            console.error('Error processing code request with documents:', error)
            throw error
        }
    }

    /**
     * Shutdown orchestrator and cleanup resources
     */
    async shutdown() {
        try {
            console.log('Shutting down CodeAgent Orchestrator...')

            if (this.followUpSystem) {
                await this.followUpSystem.shutdown()
            }

            await this.pool.end()

            console.log('CodeAgent Orchestrator shutdown complete')
        } catch (error) {
            console.error('Error during shutdown:', error)
        }
    }
}

module.exports = { CodeAgentOrchestrator }
