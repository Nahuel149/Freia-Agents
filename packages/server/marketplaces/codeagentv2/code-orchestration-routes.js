/**
 * CodeAgent Orchestration API Routes
 * Enhanced API endpoints that integrate orchestration capabilities with existing CodeAgent functionality
 */
const express = require('express');
const { CodeAgentIntegrationLayer } = require('./code-integration-layer');
const router = express.Router();

// Initialize integration layer
let integrationLayer = null;

/**
 * Initialize the orchestration routes
 */
async function initializeOrchestrationRoutes() {
    try {
        integrationLayer = new CodeAgentIntegrationLayer();
        await integrationLayer.initialize();
        console.log('CodeAgent orchestration routes initialized');
    } catch (error) {
        console.error('Failed to initialize orchestration routes:', error);
        throw error;
    }
}

/**
 * Middleware to ensure integration layer is initialized
 */
const ensureInitialized = (req, res, next) => {
    if (!integrationLayer || !integrationLayer.isInitialized) {
        return res.status(503).json({
            success: false,
            error: 'CodeAgent orchestration system not initialized',
            code: 'ORCHESTRATION_NOT_READY'
        });
    }
    next();
};

/**
 * Middleware for request validation
 */
const validateRequest = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`,
                code: 'VALIDATION_ERROR'
            });
        }
        
        next();
    };
};

/**
 * Enhanced code generation endpoint with orchestration
 * POST /api/codeagent/orchestrated/generate
 */
router.post('/generate', 
    ensureInitialized,
    validateRequest(['userId', 'prompt']),
    async (req, res) => {
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
            } = req.body;
            
            console.log(`Orchestrated code generation request from user ${userId}`);
            
            // Generate code with orchestration
            const result = await integrationLayer.generateCodeWithOrchestration({
                userId,
                prompt,
                language,
                framework,
                complexity,
                requirements,
                context,
                enableFollowUps,
                sessionId
            });
            
            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error in orchestrated code generation:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'GENERATION_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }
);

/**
 * Create new code session
 * POST /api/codeagent/orchestrated/sessions
 */
router.post('/sessions',
    ensureInitialized,
    validateRequest(['userId', 'language']),
    async (req, res) => {
        try {
            const {
                userId,
                language,
                framework = null,
                context = {},
                description = null
            } = req.body;
            
            const session = await integrationLayer.createOrGetSession({
                userId,
                language,
                framework,
                context
            });
            
            res.json({
                success: true,
                data: {
                    sessionId: session.id,
                    userId: session.user_id,
                    language: session.programming_language,
                    framework: session.framework,
                    status: session.status,
                    createdAt: session.created_at
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error creating code session:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'SESSION_CREATION_ERROR'
            });
        }
    }
);

/**
 * Get session analytics and statistics
 * GET /api/codeagent/orchestrated/sessions/:sessionId/analytics
 */
router.get('/sessions/:sessionId/analytics',
    ensureInitialized,
    async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            const analytics = await integrationLayer.getSessionAnalytics(sessionId);
            
            res.json({
                success: true,
                data: analytics,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error getting session analytics:', error);
            
            const statusCode = error.message.includes('not found') ? 404 : 500;
            
            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'ANALYTICS_ERROR'
            });
        }
    }
);

/**
 * Get session tasks and history
 * GET /api/codeagent/orchestrated/sessions/:sessionId/tasks
 */
router.get('/sessions/:sessionId/tasks',
    ensureInitialized,
    async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { limit = 50, offset = 0, status = null } = req.query;
            
            let query = `
                SELECT 
                    ct.*,
                    cs.programming_language,
                    cs.framework
                FROM code_tasks ct
                JOIN code_sessions cs ON ct.session_id = cs.id
                WHERE ct.session_id = $1
            `;
            
            const params = [sessionId];
            
            if (status) {
                query += ' AND ct.status = $2';
                params.push(status);
            }
            
            query += ' ORDER BY ct.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(parseInt(limit), parseInt(offset));
            
            const result = await integrationLayer.pool.query(query, params);
            
            res.json({
                success: true,
                data: {
                    tasks: result.rows,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        total: result.rows.length
                    }
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error getting session tasks:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'TASKS_RETRIEVAL_ERROR'
            });
        }
    }
);

/**
 * Get session follow-ups
 * GET /api/codeagent/orchestrated/sessions/:sessionId/followups
 */
router.get('/sessions/:sessionId/followups',
    ensureInitialized,
    async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { status = null, type = null, limit = 20 } = req.query;
            
            let query = `
                SELECT cf.*, cs.programming_language, cs.framework
                FROM code_followups cf
                JOIN code_sessions cs ON cf.session_id = cs.id
                WHERE cf.session_id = $1
            `;
            
            const params = [sessionId];
            
            if (status) {
                query += ' AND cf.status = $2';
                params.push(status);
            }
            
            if (type) {
                query += ' AND cf.followup_type = $' + (params.length + 1);
                params.push(type);
            }
            
            query += ' ORDER BY cf.created_at DESC LIMIT $' + (params.length + 1);
            params.push(parseInt(limit));
            
            const result = await integrationLayer.pool.query(query, params);
            
            res.json({
                success: true,
                data: {
                    followups: result.rows,
                    count: result.rows.length
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error getting session follow-ups:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'FOLLOWUPS_RETRIEVAL_ERROR'
            });
        }
    }
);

/**
 * Schedule manual follow-up
 * POST /api/codeagent/orchestrated/sessions/:sessionId/followups
 */
router.post('/sessions/:sessionId/followups',
    ensureInitialized,
    validateRequest(['type']),
    async (req, res) => {
        try {
            const { sessionId } = req.params;
            const {
                type,
                priority = 'medium',
                scheduledAt = null,
                context = {},
                customMessage = null,
                taskId = null
            } = req.body;
            
            if (!integrationLayer.orchestrator || !integrationLayer.orchestrator.followUpSystem) {
                return res.status(503).json({
                    success: false,
                    error: 'Follow-up system not available',
                    code: 'FOLLOWUP_SYSTEM_UNAVAILABLE'
                });
            }
            
            const followUp = await integrationLayer.orchestrator.followUpSystem.scheduleFollowUp({
                sessionId: parseInt(sessionId),
                taskId,
                type,
                priority,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                context,
                customMessage
            });
            
            res.json({
                success: true,
                data: {
                    followupId: followUp.id,
                    type: followUp.followup_type,
                    priority: followUp.priority_level,
                    scheduledAt: followUp.scheduled_at,
                    status: followUp.status
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error scheduling follow-up:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'FOLLOWUP_SCHEDULING_ERROR'
            });
        }
    }
);

/**
 * Get orchestration system status
 * GET /api/codeagent/orchestrated/status
 */
router.get('/status', (req, res) => {
    try {
        const status = integrationLayer ? integrationLayer.getStatus() : {
            initialized: false,
            error: 'Integration layer not initialized'
        };
        
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting orchestration status:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'STATUS_ERROR'
        });
    }
});

/**
 * Get available agent types and workflows
 * GET /api/codeagent/orchestrated/agents
 */
router.get('/agents', 
    ensureInitialized,
    async (req, res) => {
        try {
            if (!integrationLayer.orchestrator || !integrationLayer.orchestrator.agentDefinitions) {
                return res.status(503).json({
                    success: false,
                    error: 'Agent definitions not available',
                    code: 'AGENT_DEFINITIONS_UNAVAILABLE'
                });
            }
            
            const agentTypes = integrationLayer.orchestrator.agentDefinitions.agentTypes;
            const workflows = integrationLayer.orchestrator.agentDefinitions.workflows;
            
            res.json({
                success: true,
                data: {
                    agentTypes: Object.keys(agentTypes).map(key => ({
                        id: key,
                        ...agentTypes[key]
                    })),
                    workflows: Object.keys(workflows).map(key => ({
                        id: key,
                        ...workflows[key]
                    }))
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error getting agent information:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'AGENTS_RETRIEVAL_ERROR'
            });
        }
    }
);

/**
 * Execute specific agent workflow
 * POST /api/codeagent/orchestrated/agents/execute
 */
router.post('/agents/execute',
    ensureInitialized,
    validateRequest(['sessionId', 'workflowId', 'prompt']),
    async (req, res) => {
        try {
            const {
                sessionId,
                workflowId,
                prompt,
                context = {},
                agentOverrides = {}
            } = req.body;
            
            if (!integrationLayer.orchestrator) {
                return res.status(503).json({
                    success: false,
                    error: 'Orchestrator not available',
                    code: 'ORCHESTRATOR_UNAVAILABLE'
                });
            }
            
            // Execute specific workflow
            const result = await integrationLayer.orchestrator.executeSpecificWorkflow({
                sessionId: parseInt(sessionId),
                workflowId,
                prompt,
                context,
                agentOverrides
            });
            
            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error executing agent workflow:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'WORKFLOW_EXECUTION_ERROR'
            });
        }
    }
);

/**
 * Get system metrics and performance data
 * GET /api/codeagent/orchestrated/metrics
 */
router.get('/metrics',
    ensureInitialized,
    async (req, res) => {
        try {
            const { timeRange = '24h' } = req.query;
            
            // Calculate time range
            const timeRangeMs = {
                '1h': 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000
            };
            
            const rangeMs = timeRangeMs[timeRange] || timeRangeMs['24h'];
            const startTime = new Date(Date.now() - rangeMs);
            
            // Get metrics from database
            const metricsQuery = `
                SELECT 
                    COUNT(DISTINCT cs.id) as total_sessions,
                    COUNT(ct.id) as total_tasks,
                    COUNT(CASE WHEN ct.status = 'completed' THEN 1 END) as completed_tasks,
                    COUNT(CASE WHEN ct.status = 'failed' THEN 1 END) as failed_tasks,
                    COUNT(cf.id) as total_followups,
                    COUNT(CASE WHEN cf.status = 'completed' THEN 1 END) as completed_followups,
                    AVG(EXTRACT(EPOCH FROM (ct.completed_at - ct.created_at))) as avg_task_duration,
                    COUNT(DISTINCT cs.user_id) as unique_users
                FROM code_sessions cs
                LEFT JOIN code_tasks ct ON cs.id = ct.session_id
                LEFT JOIN code_followups cf ON cs.id = cf.session_id
                WHERE cs.created_at >= $1
            `;
            
            const result = await integrationLayer.pool.query(metricsQuery, [startTime]);
            const metrics = result.rows[0];
            
            // Get language distribution
            const languageQuery = `
                SELECT programming_language, COUNT(*) as count
                FROM code_sessions
                WHERE created_at >= $1
                GROUP BY programming_language
                ORDER BY count DESC
            `;
            
            const languageResult = await integrationLayer.pool.query(languageQuery, [startTime]);
            
            res.json({
                success: true,
                data: {
                    timeRange,
                    period: {
                        start: startTime.toISOString(),
                        end: new Date().toISOString()
                    },
                    metrics: {
                        totalSessions: parseInt(metrics.total_sessions) || 0,
                        totalTasks: parseInt(metrics.total_tasks) || 0,
                        completedTasks: parseInt(metrics.completed_tasks) || 0,
                        failedTasks: parseInt(metrics.failed_tasks) || 0,
                        totalFollowups: parseInt(metrics.total_followups) || 0,
                        completedFollowups: parseInt(metrics.completed_followups) || 0,
                        averageTaskDuration: parseFloat(metrics.avg_task_duration) || 0,
                        uniqueUsers: parseInt(metrics.unique_users) || 0,
                        successRate: metrics.total_tasks > 0 ? 
                            (metrics.completed_tasks / metrics.total_tasks * 100).toFixed(2) : 0
                    },
                    languageDistribution: languageResult.rows,
                    systemStatus: integrationLayer.getStatus()
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error getting system metrics:', error);
            
            res.status(500).json({
                success: false,
                error: error.message,
                code: 'METRICS_ERROR'
            });
        }
    }
);

/**
 * Health check endpoint
 * GET /api/codeagent/orchestrated/health
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            integrationLayer: {
                initialized: integrationLayer?.isInitialized || false,
                status: integrationLayer ? 'active' : 'inactive'
            },
            database: {
                status: 'unknown'
            },
            orchestrator: {
                status: integrationLayer?.orchestrator ? 'active' : 'inactive'
            }
        };
        
        // Test database connection
        if (integrationLayer?.pool) {
            try {
                await integrationLayer.pool.query('SELECT 1');
                health.database.status = 'healthy';
            } catch (error) {
                health.database.status = 'unhealthy';
                health.database.error = error.message;
                health.status = 'degraded';
            }
        }
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
            success: health.status === 'healthy',
            data: health
        });
        
    } catch (error) {
        console.error('Error in health check:', error);
        
        res.status(503).json({
            success: false,
            data: {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Document Store Integration Routes

/**
 * Get available document stores
 */
router.get('/document-stores', 
    ensureInitialized,
    async (req, res) => {
        try {
            if (!integrationLayer.orchestrator) {
                return res.status(503).json({
                    success: false,
                    error: 'Orchestrator not available',
                    code: 'ORCHESTRATOR_UNAVAILABLE'
                });
            }

            const documentStores = await integrationLayer.orchestrator.getAvailableDocumentStores();
            
            res.json({
                success: true,
                data: documentStores,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching document stores:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch document stores',
                code: 'DOCUMENT_STORES_ERROR',
                details: error.message
            });
        }
    }
);

/**
 * Get document loaders for a specific document store
 */
router.get('/document-stores/:id/loaders',
    ensureInitialized,
    async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!integrationLayer.orchestrator) {
                return res.status(503).json({
                    success: false,
                    error: 'Orchestrator not available',
                    code: 'ORCHESTRATOR_UNAVAILABLE'
                });
            }

            const loaders = await integrationLayer.orchestrator.getDocumentLoaders(id);
            
            res.json({
                success: true,
                data: loaders,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching document loaders:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch document loaders',
                code: 'DOCUMENT_LOADERS_ERROR',
                details: error.message
            });
        }
    }
);

/**
 * Process code request with document context
 */
router.post('/process-with-documents',
    ensureInitialized,
    validateRequest(['documentStoreId', 'query', 'codeRequest']),
    async (req, res) => {
        try {
            const { documentStoreId, query, codeRequest } = req.body;
            
            if (!integrationLayer.orchestrator) {
                return res.status(503).json({
                    success: false,
                    error: 'Orchestrator not available',
                    code: 'ORCHESTRATOR_UNAVAILABLE'
                });
            }

            const result = await integrationLayer.orchestrator.processCodeRequestWithDocuments({
                documentStoreId,
                query,
                codeRequest
            });
            
            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error processing code request with documents:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process code request with documents',
                code: 'DOCUMENT_PROCESSING_ERROR',
                details: error.message
            });
        }
    }
);

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
    console.error('Orchestration route error:', error);
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
});

module.exports = {
    router,
    initializeOrchestrationRoutes,
    getIntegrationLayer: () => integrationLayer
};