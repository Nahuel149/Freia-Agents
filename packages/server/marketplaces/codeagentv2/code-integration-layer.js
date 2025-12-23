/**
 * CodeAgent Integration Layer - Connects orchestration system with existing CodeAgent controller
 * Provides seamless integration between new orchestration features and existing API endpoints
 */
const { CodeAgentOrchestrator } = require('./code-agent-orchestrator')
const { Pool } = require('pg')

class CodeAgentIntegrationLayer {
    constructor(config = {}) {
        this.config = {
            // Database configuration
            database: {
                host: process.env.POSTGRES_HOST || process.env.DATABASE_HOST || 'localhost',
                port: process.env.POSTGRES_PORT || process.env.DATABASE_PORT || 5432,
                database: process.env.POSTGRES_DB || process.env.DATABASE_NAME || 'freia_dev',
                user: process.env.POSTGRES_USER || process.env.DATABASE_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || process.env.DATABASE_PASSWORD || 'password',
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
                ssl:
                    process.env.DATABASE_SSL === 'true'
                        ? {
                              rejectUnauthorized: false
                          }
                        : false
            },

            // Flowise integration
            flowise: {
                apiUrl: process.env.FLOWISE_API_URL || 'http://localhost:3000',
                apiKey: process.env.FLOWISE_API_KEY || '',
                chatflowId: process.env.FLOWISE_CODEAGENT_CHATFLOW_ID || 'code-agent-flow'
            },

            // Feature flags
            features: {
                enableOrchestration: process.env.ENABLE_CODE_ORCHESTRATION === 'true',
                enableFollowUps: process.env.ENABLE_CODE_FOLLOWUPS === 'true',
                enableAnalytics: process.env.ENABLE_CODE_ANALYTICS === 'true',
                enableAutoOptimization: process.env.ENABLE_AUTO_OPTIMIZATION === 'true'
            },

            // Performance settings
            performance: {
                maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_CODE_SESSIONS) || 10,
                sessionTimeoutMs: parseInt(process.env.CODE_SESSION_TIMEOUT_MS) || 30 * 60 * 1000, // 30 minutes
                maxTasksPerSession: parseInt(process.env.MAX_TASKS_PER_SESSION) || 50
            },

            ...config
        }

        this.pool = null
        this.orchestrator = null
        this.isInitialized = false
        this.activeSessions = new Map()

        console.log('CodeAgent Integration Layer initialized with config:', {
            orchestrationEnabled: this.config.features.enableOrchestration,
            followUpsEnabled: this.config.features.enableFollowUps,
            maxConcurrentSessions: this.config.performance.maxConcurrentSessions
        })
    }

    /**
     * Initialize the integration layer
     */
    async initialize() {
        try {
            console.log('Initializing CodeAgent Integration Layer...')

            // Initialize database connection
            await this.initializeDatabase()

            // Initialize orchestrator if enabled
            if (this.config.features.enableOrchestration) {
                await this.initializeOrchestrator()
            }

            // Setup session cleanup
            this.setupSessionCleanup()

            this.isInitialized = true
            console.log('CodeAgent Integration Layer initialized successfully')
        } catch (error) {
            console.error('Failed to initialize CodeAgent Integration Layer:', error)
            throw error
        }
    }

    /**
     * Initialize database connection
     */
    async initializeDatabase() {
        try {
            this.pool = new Pool(this.config.database)

            // Test connection
            const client = await this.pool.connect()
            await client.query('SELECT NOW()')
            client.release()

            console.log('Database connection established for CodeAgent integration')
        } catch (error) {
            console.error('Database initialization failed:', error)
            throw error
        }
    }

    /**
     * Initialize orchestrator
     */
    async initializeOrchestrator() {
        try {
            this.orchestrator = new CodeAgentOrchestrator(this.pool, this.config)
            await this.orchestrator.initialize()

            console.log('CodeAgent Orchestrator initialized')
        } catch (error) {
            console.error('Orchestrator initialization failed:', error)
            throw error
        }
    }

    /**
     * Enhanced code generation with orchestration
     */
    async generateCodeWithOrchestration(request) {
        try {
            const {
                userId,
                prompt,
                language = 'javascript',
                framework = null,
                complexity = 'medium',
                requirements = [],
                context = {},
                enableFollowUps = true,
                sessionId = null
            } = request

            // Validate request
            this.validateCodeRequest(request)

            // Create or get session
            const session = await this.createOrGetSession({
                userId,
                sessionId,
                language,
                framework,
                context
            })

            // Check if orchestration is enabled and beneficial
            const useOrchestration = this.config.features.enableOrchestration && this.shouldUseOrchestration(request)

            let result

            if (useOrchestration && this.orchestrator) {
                // Use orchestrated approach
                console.log(`Using orchestrated code generation for session ${session.id}`)

                result = await this.orchestrator.processCodeRequest({
                    sessionId: session.id,
                    userId,
                    prompt,
                    language,
                    framework,
                    complexity,
                    requirements,
                    context
                })

                // Schedule follow-ups if enabled
                if (enableFollowUps && this.config.features.enableFollowUps) {
                    await this.scheduleAutomaticFollowUps(session.id, result, {
                        language,
                        framework,
                        complexity
                    })
                }
            } else {
                // Use traditional approach (fallback to existing controller)
                console.log(`Using traditional code generation for session ${session.id}`)

                result = await this.generateCodeTraditional({
                    sessionId: session.id,
                    userId,
                    prompt,
                    language,
                    framework,
                    context
                })
            }

            // Update session activity
            await this.updateSessionActivity(session.id)

            // Add integration metadata
            result.integration = {
                sessionId: session.id,
                orchestrationUsed: useOrchestration,
                followUpsScheduled: enableFollowUps && this.config.features.enableFollowUps,
                timestamp: new Date().toISOString()
            }

            return result
        } catch (error) {
            console.error('Error in enhanced code generation:', error)
            throw error
        }
    }

    /**
     * Traditional code generation (fallback)
     */
    async generateCodeTraditional(request) {
        const { sessionId, userId, prompt, language, framework, context } = request

        // Create task record
        const taskQuery = `
            INSERT INTO code_tasks (
                session_id, user_id, task_description, programming_language,
                framework, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            RETURNING *
        `

        const taskResult = await this.pool.query(taskQuery, [sessionId, userId, prompt, language, framework, 'pending'])

        const task = taskResult.rows[0]

        try {
            // Simulate code generation (in real implementation, this would call Flowise or AI service)
            const generatedCode = await this.callFlowiseForCodeGeneration({
                prompt,
                language,
                framework,
                context
            })

            // Update task with result
            const updateQuery = `
                UPDATE code_tasks SET
                    generated_code = $1,
                    status = $2,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `

            const updateResult = await this.pool.query(updateQuery, [generatedCode, 'completed', task.id])

            return {
                success: true,
                taskId: task.id,
                code: generatedCode,
                language,
                framework,
                metadata: {
                    generationTime: Date.now() - new Date(task.created_at).getTime(),
                    approach: 'traditional'
                }
            }
        } catch (error) {
            // Update task with error
            await this.pool.query('UPDATE code_tasks SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [
                'failed',
                error.message,
                task.id
            ])

            throw error
        }
    }

    /**
     * Call Flowise for code generation
     */
    async callFlowiseForCodeGeneration(request) {
        try {
            const { prompt, language, framework, context } = request

            // Prepare Flowise request
            const flowiseRequest = {
                question: prompt,
                overrideConfig: {
                    programming_language: language,
                    framework: framework || 'none',
                    context: JSON.stringify(context)
                }
            }

            // Make request to Flowise (simulated for now)
            // In real implementation, this would be an HTTP request to Flowise API
            const response = await this.simulateFlowiseCall(flowiseRequest)

            return response.code || response.text || 'Generated code placeholder'
        } catch (error) {
            console.error('Flowise call failed:', error)
            throw new Error('Code generation service unavailable')
        }
    }

    /**
     * Simulate Flowise call (replace with actual HTTP request)
     */
    async simulateFlowiseCall(request) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

        const { question, overrideConfig } = request
        const language = overrideConfig.programming_language || 'javascript'

        // Generate sample code based on language
        const codeTemplates = {
            javascript: `// Generated JavaScript code\nfunction generatedFunction() {\n    // ${question}\n    console.log('Hello from generated code!');\n    return 'success';\n}\n\nmodule.exports = { generatedFunction };`,
            python: `# Generated Python code\ndef generated_function():\n    """${question}"""\n    print('Hello from generated code!')\n    return 'success'\n\nif __name__ == '__main__':\n    generated_function()`,
            java: `// Generated Java code\npublic class GeneratedClass {\n    // ${question}\n    public static void main(String[] args) {\n        System.out.println("Hello from generated code!");\n    }\n    \n    public String generatedMethod() {\n        return "success";\n    }\n}`,
            typescript: `// Generated TypeScript code\ninterface GeneratedInterface {\n    message: string;\n}\n\nclass GeneratedClass implements GeneratedInterface {\n    message: string;\n    \n    constructor() {\n        // ${question}\n        this.message = 'Hello from generated code!';\n    }\n    \n    generatedMethod(): string {\n        return 'success';\n    }\n}\n\nexport { GeneratedClass };`
        }

        return {
            code: codeTemplates[language] || codeTemplates.javascript,
            metadata: {
                language,
                framework: overrideConfig.framework,
                generatedAt: new Date().toISOString()
            }
        }
    }

    /**
     * Create or get existing session
     */
    async createOrGetSession(request) {
        const { userId, sessionId, language, framework, context } = request

        if (sessionId) {
            // Try to get existing session
            const existingQuery = 'SELECT * FROM code_sessions WHERE id = $1 AND user_id = $2'
            const existingResult = await this.pool.query(existingQuery, [sessionId, userId])

            if (existingResult.rows.length > 0) {
                return existingResult.rows[0]
            }
        }

        // Create new session
        const sessionQuery = `
            INSERT INTO code_sessions (
                user_id, programming_language, framework, session_context,
                status, created_at, last_activity_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `

        const sessionResult = await this.pool.query(sessionQuery, [userId, language, framework, JSON.stringify(context), 'active'])

        const session = sessionResult.rows[0]

        // Add to active sessions
        this.activeSessions.set(session.id, {
            ...session,
            lastActivity: Date.now()
        })

        return session
    }

    /**
     * Update session activity
     */
    async updateSessionActivity(sessionId) {
        try {
            await this.pool.query('UPDATE code_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1', [sessionId])

            // Update in-memory tracking
            if (this.activeSessions.has(sessionId)) {
                const session = this.activeSessions.get(sessionId)
                session.lastActivity = Date.now()
            }
        } catch (error) {
            console.error('Error updating session activity:', error)
        }
    }

    /**
     * Determine if orchestration should be used
     */
    shouldUseOrchestration(request) {
        const { complexity, requirements = [], prompt } = request

        // Use orchestration for complex requests
        if (complexity === 'high') return true

        // Use orchestration if multiple requirements
        if (requirements.length > 2) return true

        // Use orchestration for long prompts (likely complex)
        if (prompt && prompt.length > 500) return true

        // Use orchestration if specific keywords indicate complexity
        const complexKeywords = [
            'architecture',
            'system',
            'database',
            'api',
            'microservice',
            'authentication',
            'authorization',
            'security',
            'performance',
            'scalability',
            'integration',
            'deployment'
        ]

        const promptLower = prompt.toLowerCase()
        const hasComplexKeywords = complexKeywords.some((keyword) => promptLower.includes(keyword))

        return hasComplexKeywords
    }

    /**
     * Schedule automatic follow-ups
     */
    async scheduleAutomaticFollowUps(sessionId, result, context) {
        try {
            if (!this.orchestrator || !this.orchestrator.followUpSystem) {
                return
            }

            const followUps = []

            // Schedule code review follow-up
            followUps.push({
                sessionId,
                type: 'code_review',
                priority: 'low',
                context: {
                    ...context,
                    qualityScore: result.metadata?.qualityScore
                }
            })

            // Schedule optimization follow-up for complex code
            if (context.complexity === 'high' || result.code?.length > 1000) {
                followUps.push({
                    sessionId,
                    type: 'optimization_suggestion',
                    priority: 'medium',
                    context
                })
            }

            // Schedule testing reminder
            followUps.push({
                sessionId,
                type: 'testing_reminder',
                priority: 'medium',
                context
            })

            // Schedule documentation update for complex code
            if (result.code?.length > 500) {
                followUps.push({
                    sessionId,
                    type: 'documentation_update',
                    priority: 'low',
                    context
                })
            }

            // Schedule all follow-ups
            for (const followUp of followUps) {
                await this.orchestrator.followUpSystem.scheduleFollowUp(followUp)
            }

            console.log(`Scheduled ${followUps.length} follow-ups for session ${sessionId}`)
        } catch (error) {
            console.error('Error scheduling follow-ups:', error)
            // Don't throw - follow-up scheduling shouldn't break main flow
        }
    }

    /**
     * Get session analytics
     */
    async getSessionAnalytics(sessionId) {
        try {
            const analyticsQuery = `
                SELECT 
                    cs.*,
                    COUNT(ct.id) as total_tasks,
                    COUNT(CASE WHEN ct.status = 'completed' THEN 1 END) as completed_tasks,
                    COUNT(CASE WHEN ct.status = 'failed' THEN 1 END) as failed_tasks,
                    COUNT(cf.id) as total_followups,
                    COUNT(CASE WHEN cf.status = 'completed' THEN 1 END) as completed_followups,
                    AVG(EXTRACT(EPOCH FROM (ct.completed_at - ct.created_at))) as avg_task_duration
                FROM code_sessions cs
                LEFT JOIN code_tasks ct ON cs.id = ct.session_id
                LEFT JOIN code_followups cf ON cs.id = cf.session_id
                WHERE cs.id = $1
                GROUP BY cs.id
            `

            const result = await this.pool.query(analyticsQuery, [sessionId])

            if (result.rows.length === 0) {
                throw new Error('Session not found')
            }

            const analytics = result.rows[0]

            return {
                sessionId: analytics.id,
                userId: analytics.user_id,
                language: analytics.programming_language,
                framework: analytics.framework,
                status: analytics.status,
                createdAt: analytics.created_at,
                lastActivityAt: analytics.last_activity_at,
                statistics: {
                    totalTasks: parseInt(analytics.total_tasks) || 0,
                    completedTasks: parseInt(analytics.completed_tasks) || 0,
                    failedTasks: parseInt(analytics.failed_tasks) || 0,
                    totalFollowups: parseInt(analytics.total_followups) || 0,
                    completedFollowups: parseInt(analytics.completed_followups) || 0,
                    averageTaskDuration: parseFloat(analytics.avg_task_duration) || 0,
                    successRate: analytics.total_tasks > 0 ? ((analytics.completed_tasks / analytics.total_tasks) * 100).toFixed(2) : 0
                }
            }
        } catch (error) {
            console.error('Error getting session analytics:', error)
            throw error
        }
    }

    /**
     * Validate code request
     */
    validateCodeRequest(request) {
        const { userId, prompt } = request

        if (!userId) {
            throw new Error('User ID is required')
        }

        if (!prompt || prompt.trim().length === 0) {
            throw new Error('Prompt is required')
        }

        if (prompt.length > 10000) {
            throw new Error('Prompt is too long (max 10000 characters)')
        }
    }

    /**
     * Setup session cleanup
     */
    setupSessionCleanup() {
        // Clean up inactive sessions every 5 minutes
        setInterval(async () => {
            try {
                await this.cleanupInactiveSessions()
            } catch (error) {
                console.error('Error in session cleanup:', error)
            }
        }, 5 * 60 * 1000)
    }

    /**
     * Clean up inactive sessions
     */
    async cleanupInactiveSessions() {
        const now = Date.now()
        const timeoutMs = this.config.performance.sessionTimeoutMs

        // Clean up in-memory sessions
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (now - session.lastActivity > timeoutMs) {
                this.activeSessions.delete(sessionId)

                // Update database
                await this.pool.query('UPDATE code_sessions SET status = $1 WHERE id = $2', ['inactive', sessionId])

                console.log(`Session ${sessionId} marked as inactive due to timeout`)
            }
        }
    }

    /**
     * Get integration status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            orchestrationEnabled: this.config.features.enableOrchestration,
            followUpsEnabled: this.config.features.enableFollowUps,
            activeSessions: this.activeSessions.size,
            maxConcurrentSessions: this.config.performance.maxConcurrentSessions,
            orchestratorStatus: this.orchestrator ? 'active' : 'disabled'
        }
    }

    /**
     * Shutdown integration layer
     */
    async shutdown() {
        try {
            console.log('Shutting down CodeAgent Integration Layer...')

            // Shutdown orchestrator
            if (this.orchestrator) {
                await this.orchestrator.shutdown()
            }

            // Close database connections
            if (this.pool) {
                await this.pool.end()
            }

            // Clear active sessions
            this.activeSessions.clear()

            this.isInitialized = false

            console.log('CodeAgent Integration Layer shutdown complete')
        } catch (error) {
            console.error('Error during integration layer shutdown:', error)
        }
    }
}

module.exports = { CodeAgentIntegrationLayer }
