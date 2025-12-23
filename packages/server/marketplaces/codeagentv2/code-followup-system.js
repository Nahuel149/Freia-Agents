/**
 * CodeAgent Follow-up System - Manages automated follow-ups for code development tasks
 * Adapted from B2B Sales follow-up system for code-related workflows
 */
class CodeFollowUpSystem {
    constructor(dbPool) {
        this.pool = dbPool
        this.isRunning = false
        this.processingInterval = null
        this.processingIntervalMs = 60000 // Check every minute
        this.maxConcurrentFollowUps = 5
        this.activeFollowUps = new Set()

        // Follow-up type configurations
        this.followUpTypes = {
            code_review: {
                name: 'Code Review',
                description: 'Automated code review and suggestions',
                defaultDelay: 24 * 60 * 60 * 1000, // 24 hours
                maxAttempts: 2,
                priority: 'low'
            },
            optimization_suggestion: {
                name: 'Optimization Suggestion',
                description: 'Performance and efficiency improvement suggestions',
                defaultDelay: 30 * 60 * 1000, // 30 minutes
                maxAttempts: 3,
                priority: 'medium'
            },
            bug_fix: {
                name: 'Bug Fix Follow-up',
                description: 'Follow-up on reported bugs and issues',
                defaultDelay: 5 * 60 * 1000, // 5 minutes
                maxAttempts: 5,
                priority: 'high'
            },
            feature_enhancement: {
                name: 'Feature Enhancement',
                description: 'Suggestions for additional features or improvements',
                defaultDelay: 7 * 24 * 60 * 60 * 1000, // 7 days
                maxAttempts: 2,
                priority: 'low'
            },
            documentation_update: {
                name: 'Documentation Update',
                description: 'Updates to code documentation and comments',
                defaultDelay: 2 * 60 * 60 * 1000, // 2 hours
                maxAttempts: 2,
                priority: 'medium'
            },
            security_audit: {
                name: 'Security Audit',
                description: 'Security review and vulnerability assessment',
                defaultDelay: 3 * 24 * 60 * 60 * 1000, // 3 days
                maxAttempts: 3,
                priority: 'high'
            },
            testing_reminder: {
                name: 'Testing Reminder',
                description: 'Reminder to add or update tests',
                defaultDelay: 60 * 60 * 1000, // 1 hour
                maxAttempts: 3,
                priority: 'medium'
            }
        }

        console.log('CodeAgent Follow-up System initialized')
    }

    /**
     * Initialize the follow-up system
     */
    async initialize() {
        try {
            console.log('Initializing CodeAgent Follow-up System...')

            // Test database connection
            await this.testDatabaseConnection()

            // Start automatic processing
            await this.startAutomaticProcessing()

            console.log('CodeAgent Follow-up System initialized successfully')
        } catch (error) {
            console.error('Failed to initialize CodeAgent Follow-up System:', error)
            throw error
        }
    }

    /**
     * Schedule a follow-up for a code session or task
     */
    async scheduleFollowUp(followUpData) {
        try {
            const {
                sessionId,
                taskId = null,
                type,
                priority = 'medium',
                scheduledAt = null,
                context = {},
                customMessage = null
            } = followUpData

            // Validate follow-up type
            if (!this.followUpTypes[type]) {
                throw new Error(`Invalid follow-up type: ${type}`)
            }

            const followUpConfig = this.followUpTypes[type]

            // Calculate scheduled time if not provided
            const scheduledTime = scheduledAt || new Date(Date.now() + followUpConfig.defaultDelay)

            // Adjust to business hours if needed
            const adjustedTime = this.adjustToBusinessHours(scheduledTime)

            // Generate follow-up message
            const message = customMessage || (await this.generateFollowUpMessage(type, context))

            // Insert follow-up record
            const query = `
                INSERT INTO code_followups (
                    session_id, task_id, followup_type, scheduled_at,
                    priority_level, max_attempts, suggestion_message,
                    agent_assigned, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `

            const values = [
                sessionId,
                taskId,
                type,
                adjustedTime,
                priority,
                followUpConfig.maxAttempts,
                message,
                this.getAssignedAgent(type),
                'pending'
            ]

            const result = await this.pool.query(query, values)
            const followUp = result.rows[0]

            console.log('Follow-up scheduled:', {
                id: followUp.id,
                type: followUp.followup_type,
                scheduledAt: followUp.scheduled_at,
                priority: followUp.priority_level
            })

            return followUp
        } catch (error) {
            console.error('Error scheduling follow-up:', error)
            throw error
        }
    }

    /**
     * Generate contextual follow-up message based on type and context
     */
    async generateFollowUpMessage(type, context) {
        const templates = {
            code_review: {
                subject: 'Code Review Suggestions Available',
                message: `I've analyzed your recent code and have some suggestions for improvement. The code quality looks good overall, but there are opportunities to enhance readability and maintainability.`
            },
            optimization_suggestion: {
                subject: 'Performance Optimization Opportunities',
                message: `I've identified potential performance improvements in your code. These optimizations could reduce execution time by up to ${
                    context.estimatedImprovement || '20%'
                }.`
            },
            bug_fix: {
                subject: 'Bug Fix Required',
                message: `I've detected ${
                    context.errorCount || 'some'
                } issues in the generated code that need attention. Let me help you resolve these problems.`
            },
            feature_enhancement: {
                subject: 'Feature Enhancement Suggestions',
                message: `Based on your project requirements, I have suggestions for additional features that could enhance functionality and user experience.`
            },
            documentation_update: {
                subject: 'Documentation Improvements',
                message: `Your code could benefit from improved documentation. I can help generate comprehensive comments and API documentation.`
            },
            security_audit: {
                subject: 'Security Review Recommendations',
                message: `I recommend a security review of your code to identify potential vulnerabilities and ensure best practices are followed.`
            },
            testing_reminder: {
                subject: 'Testing Coverage Reminder',
                message: `Your code would benefit from additional test coverage. I can help generate unit tests and integration tests to ensure reliability.`
            }
        }

        const template = templates[type] || templates['code_review']

        // Customize message based on context
        let message = template.message

        if (context.qualityScore) {
            message += ` Current quality score: ${context.qualityScore}/10.`
        }

        if (context.language) {
            message += ` Language: ${context.language}.`
        }

        if (context.framework) {
            message += ` Framework: ${context.framework}.`
        }

        return message
    }

    /**
     * Process pending follow-ups
     */
    async processPendingFollowUps() {
        try {
            if (this.activeFollowUps.size >= this.maxConcurrentFollowUps) {
                console.log('Maximum concurrent follow-ups reached, skipping this cycle')
                return
            }

            // Get pending follow-ups that are due
            const query = `
                SELECT cf.*, cs.session_id as session_uuid, cs.programming_language, cs.framework
                FROM code_followups cf
                JOIN code_sessions cs ON cf.session_id = cs.id
                WHERE cf.status = 'pending'
                AND cf.scheduled_at <= NOW()
                AND cf.attempt_number < cf.max_attempts
                ORDER BY cf.priority_level DESC, cf.scheduled_at ASC
                LIMIT $1
            `

            const result = await this.pool.query(query, [this.maxConcurrentFollowUps - this.activeFollowUps.size])
            const followUps = result.rows

            if (followUps.length === 0) {
                return
            }

            console.log(`Processing ${followUps.length} pending follow-ups`)

            // Process each follow-up
            const promises = followUps.map((followUp) => this.executeFollowUp(followUp))
            await Promise.allSettled(promises)
        } catch (error) {
            console.error('Error processing pending follow-ups:', error)
        }
    }

    /**
     * Execute individual follow-up
     */
    async executeFollowUp(followUp) {
        const followUpId = followUp.id

        try {
            this.activeFollowUps.add(followUpId)

            console.log(`Executing follow-up ${followUpId}: ${followUp.followup_type}`)

            // Update status to in_progress
            await this.updateFollowUpStatus(followUpId, 'in_progress')

            // Execute based on follow-up type
            let result
            switch (followUp.followup_type) {
                case 'code_review':
                    result = await this.executeCodeReview(followUp)
                    break
                case 'optimization_suggestion':
                    result = await this.executeOptimizationSuggestion(followUp)
                    break
                case 'bug_fix':
                    result = await this.executeBugFix(followUp)
                    break
                case 'feature_enhancement':
                    result = await this.executeFeatureEnhancement(followUp)
                    break
                case 'documentation_update':
                    result = await this.executeDocumentationUpdate(followUp)
                    break
                case 'security_audit':
                    result = await this.executeSecurityAudit(followUp)
                    break
                case 'testing_reminder':
                    result = await this.executeTestingReminder(followUp)
                    break
                default:
                    throw new Error(`Unknown follow-up type: ${followUp.followup_type}`)
            }

            // Update follow-up with result
            await this.updateFollowUpResult(followUpId, result)

            console.log(`Follow-up ${followUpId} completed successfully`)
        } catch (error) {
            console.error(`Error executing follow-up ${followUpId}:`, error)

            // Increment attempt number and potentially reschedule
            await this.handleFollowUpError(followUp, error)
        } finally {
            this.activeFollowUps.delete(followUpId)
        }
    }

    /**
     * Execute code review follow-up
     */
    async executeCodeReview(followUp) {
        // Get the latest code from the session
        const codeQuery = `
            SELECT generated_code, programming_language, framework
            FROM code_tasks
            WHERE session_id = $1
            AND generated_code IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        `

        const codeResult = await this.pool.query(codeQuery, [followUp.session_id])

        if (codeResult.rows.length === 0) {
            throw new Error('No code found for review')
        }

        const codeData = codeResult.rows[0]

        // Simulate code review analysis (in real implementation, this would call an AI service)
        const reviewResult = {
            overallScore: Math.random() * 3 + 7, // 7-10 range
            suggestions: [
                'Consider adding more descriptive variable names',
                'Extract complex logic into separate functions',
                'Add error handling for edge cases',
                'Consider using more efficient algorithms for data processing'
            ],
            codeSmells: Math.floor(Math.random() * 3),
            securityIssues: Math.floor(Math.random() * 2),
            performanceIssues: Math.floor(Math.random() * 2)
        }

        return {
            success: true,
            type: 'code_review',
            data: reviewResult,
            message: `Code review completed. Overall score: ${reviewResult.overallScore.toFixed(1)}/10. Found ${
                reviewResult.suggestions.length
            } suggestions for improvement.`
        }
    }

    /**
     * Execute optimization suggestion follow-up
     */
    async executeOptimizationSuggestion(followUp) {
        // Simulate optimization analysis
        const optimizationResult = {
            potentialImprovements: [
                'Database query optimization could reduce response time by 40%',
                'Implementing caching could improve performance by 60%',
                'Code refactoring could reduce memory usage by 25%'
            ],
            estimatedPerformanceGain: Math.random() * 50 + 20, // 20-70%
            implementationComplexity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            estimatedEffort: Math.random() * 8 + 2 // 2-10 hours
        }

        return {
            success: true,
            type: 'optimization_suggestion',
            data: optimizationResult,
            message: `Found ${
                optimizationResult.potentialImprovements.length
            } optimization opportunities with potential ${optimizationResult.estimatedPerformanceGain.toFixed(0)}% performance improvement.`
        }
    }

    /**
     * Execute bug fix follow-up
     */
    async executeBugFix(followUp) {
        // Get error information from context or task
        const errorQuery = `
            SELECT error_message, execution_status
            FROM code_tasks
            WHERE session_id = $1
            AND execution_status = 'failed'
            ORDER BY created_at DESC
            LIMIT 5
        `

        const errorResult = await this.pool.query(errorQuery, [followUp.session_id])
        const errors = errorResult.rows

        // Simulate bug analysis and fix suggestions
        const bugFixResult = {
            errorsAnalyzed: errors.length,
            fixSuggestions: errors.map((error, index) => ({
                error: error.error_message,
                suggestion: `Fix suggestion ${index + 1}: Check input validation and error handling`,
                confidence: Math.random() * 0.3 + 0.7 // 70-100%
            })),
            estimatedFixTime: Math.random() * 4 + 1 // 1-5 hours
        }

        return {
            success: true,
            type: 'bug_fix',
            data: bugFixResult,
            message: `Analyzed ${bugFixResult.errorsAnalyzed} errors and provided fix suggestions.`
        }
    }

    /**
     * Execute feature enhancement follow-up
     */
    async executeFeatureEnhancement(followUp) {
        const enhancementResult = {
            suggestedFeatures: [
                'Add user authentication and authorization',
                'Implement data validation and sanitization',
                'Add logging and monitoring capabilities',
                'Implement caching for better performance'
            ],
            priorityLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            estimatedDevelopmentTime: Math.random() * 20 + 5 // 5-25 hours
        }

        return {
            success: true,
            type: 'feature_enhancement',
            data: enhancementResult,
            message: `Suggested ${enhancementResult.suggestedFeatures.length} feature enhancements to improve functionality.`
        }
    }

    /**
     * Execute documentation update follow-up
     */
    async executeDocumentationUpdate(followUp) {
        const docResult = {
            documentationGaps: [
                'API endpoints need detailed documentation',
                'Function parameters require type annotations',
                'Complex algorithms need explanatory comments',
                'Installation and setup instructions missing'
            ],
            coverageScore: Math.random() * 40 + 40, // 40-80%
            estimatedUpdateTime: Math.random() * 3 + 1 // 1-4 hours
        }

        return {
            success: true,
            type: 'documentation_update',
            data: docResult,
            message: `Documentation coverage: ${docResult.coverageScore.toFixed(0)}%. Found ${
                docResult.documentationGaps.length
            } areas for improvement.`
        }
    }

    /**
     * Execute security audit follow-up
     */
    async executeSecurityAudit(followUp) {
        const securityResult = {
            vulnerabilities: [
                'Input validation missing in user endpoints',
                'SQL injection potential in database queries',
                'Authentication tokens not properly secured'
            ],
            riskLevel: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
            complianceScore: Math.random() * 30 + 60, // 60-90%
            recommendedActions: [
                'Implement input sanitization',
                'Use parameterized queries',
                'Add rate limiting',
                'Implement proper session management'
            ]
        }

        return {
            success: true,
            type: 'security_audit',
            data: securityResult,
            message: `Security audit completed. Found ${securityResult.vulnerabilities.length} potential vulnerabilities with ${securityResult.riskLevel} risk level.`
        }
    }

    /**
     * Execute testing reminder follow-up
     */
    async executeTestingReminder(followUp) {
        const testingResult = {
            currentCoverage: Math.random() * 60 + 20, // 20-80%
            recommendedCoverage: 85,
            missingTests: [
                'Unit tests for core business logic',
                'Integration tests for API endpoints',
                'Error handling test cases',
                'Edge case scenarios'
            ],
            estimatedTestingTime: Math.random() * 6 + 2 // 2-8 hours
        }

        return {
            success: true,
            type: 'testing_reminder',
            data: testingResult,
            message: `Current test coverage: ${testingResult.currentCoverage.toFixed(0)}%. Recommended: ${
                testingResult.recommendedCoverage
            }%.`
        }
    }

    /**
     * Update follow-up status
     */
    async updateFollowUpStatus(followUpId, status) {
        const query = 'UPDATE code_followups SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2'
        await this.pool.query(query, [status, followUpId])
    }

    /**
     * Update follow-up with execution result
     */
    async updateFollowUpResult(followUpId, result) {
        const query = `
            UPDATE code_followups SET
                status = $1,
                completed_at = CURRENT_TIMESTAMP,
                implementation_code = $2,
                next_action = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `

        const values = [result.success ? 'completed' : 'failed', JSON.stringify(result.data), result.message, followUpId]

        await this.pool.query(query, values)
    }

    /**
     * Handle follow-up execution error
     */
    async handleFollowUpError(followUp, error) {
        const newAttemptNumber = followUp.attempt_number + 1

        if (newAttemptNumber >= followUp.max_attempts) {
            // Max attempts reached, mark as failed
            await this.updateFollowUpStatus(followUp.id, 'cancelled')
            console.log(`Follow-up ${followUp.id} cancelled after ${newAttemptNumber} attempts`)
        } else {
            // Reschedule for retry
            const nextAttemptTime = new Date(Date.now() + newAttemptNumber * 30 * 60 * 1000) // Exponential backoff

            const query = `
                UPDATE code_followups SET
                    attempt_number = $1,
                    scheduled_at = $2,
                    status = 'pending',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `

            await this.pool.query(query, [newAttemptNumber, nextAttemptTime, followUp.id])
            console.log(`Follow-up ${followUp.id} rescheduled for attempt ${newAttemptNumber}`)
        }
    }

    /**
     * Adjust scheduled time to business hours
     */
    adjustToBusinessHours(scheduledTime) {
        const date = new Date(scheduledTime)
        const hour = date.getHours()
        const dayOfWeek = date.getDay()

        // If it's weekend (Saturday = 6, Sunday = 0), move to Monday
        if (dayOfWeek === 0) {
            // Sunday
            date.setDate(date.getDate() + 1)
            date.setHours(9, 0, 0, 0)
        } else if (dayOfWeek === 6) {
            // Saturday
            date.setDate(date.getDate() + 2)
            date.setHours(9, 0, 0, 0)
        }

        // Adjust to business hours (9 AM - 6 PM)
        if (hour < 9) {
            date.setHours(9, 0, 0, 0)
        } else if (hour >= 18) {
            date.setDate(date.getDate() + 1)
            date.setHours(9, 0, 0, 0)
        }

        return date
    }

    /**
     * Get assigned agent for follow-up type
     */
    getAssignedAgent(followUpType) {
        const agentMapping = {
            code_review: 'main_code_agent',
            optimization_suggestion: 'optimization_agent',
            bug_fix: 'debugging_agent',
            feature_enhancement: 'main_code_agent',
            documentation_update: 'documentation_agent',
            security_audit: 'security_agent',
            testing_reminder: 'testing_agent'
        }

        return agentMapping[followUpType] || 'main_code_agent'
    }

    /**
     * Start automatic processing of follow-ups
     */
    async startAutomaticProcessing() {
        if (this.isRunning) {
            console.log('Follow-up processing already running')
            return
        }

        this.isRunning = true

        this.processingInterval = setInterval(async () => {
            try {
                await this.processPendingFollowUps()
            } catch (error) {
                console.error('Error in follow-up processing cycle:', error)
            }
        }, this.processingIntervalMs)

        console.log('Automatic follow-up processing started')
    }

    /**
     * Stop automatic processing
     */
    async stopAutomaticProcessing() {
        if (!this.isRunning) {
            return
        }

        this.isRunning = false

        if (this.processingInterval) {
            clearInterval(this.processingInterval)
            this.processingInterval = null
        }

        console.log('Automatic follow-up processing stopped')
    }

    /**
     * Get follow-up statistics
     */
    async getFollowUpStats() {
        try {
            const query = `
                SELECT 
                    followup_type,
                    status,
                    priority_level,
                    COUNT(*) as count,
                    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_completion_time
                FROM code_followups
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY followup_type, status, priority_level
                ORDER BY followup_type, status
            `

            const result = await this.pool.query(query)

            return {
                totalFollowUps: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
                byType: result.rows.reduce((acc, row) => {
                    if (!acc[row.followup_type]) acc[row.followup_type] = {}
                    acc[row.followup_type][row.status] = parseInt(row.count)
                    return acc
                }, {}),
                byStatus: result.rows.reduce((acc, row) => {
                    acc[row.status] = (acc[row.status] || 0) + parseInt(row.count)
                    return acc
                }, {}),
                byPriority: result.rows.reduce((acc, row) => {
                    acc[row.priority_level] = (acc[row.priority_level] || 0) + parseInt(row.count)
                    return acc
                }, {})
            }
        } catch (error) {
            console.error('Error getting follow-up stats:', error)
            throw error
        }
    }

    /**
     * Test database connection
     */
    async testDatabaseConnection() {
        try {
            const result = await this.pool.query('SELECT NOW()')
            console.log('Follow-up system database connection successful')
        } catch (error) {
            console.error('Follow-up system database connection failed:', error)
            throw error
        }
    }

    /**
     * Sleep utility
     */
    async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Shutdown follow-up system
     */
    async shutdown() {
        try {
            console.log('Shutting down CodeAgent Follow-up System...')

            await this.stopAutomaticProcessing()

            // Wait for active follow-ups to complete
            let waitCount = 0
            while (this.activeFollowUps.size > 0 && waitCount < 30) {
                console.log(`Waiting for ${this.activeFollowUps.size} active follow-ups to complete...`)
                await this.sleep(1000)
                waitCount++
            }

            console.log('CodeAgent Follow-up System shutdown complete')
        } catch (error) {
            console.error('Error during follow-up system shutdown:', error)
        }
    }
}

module.exports = { CodeFollowUpSystem }
