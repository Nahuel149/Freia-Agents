/**
 * Code Analysis System
 * Automated code analysis and improvement suggestions for generated code
 */
const { Pool } = require('pg')

class CodeAnalysisSystem {
    constructor(config = {}) {
        this.pool =
            config.pool ||
            new Pool({
                connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/freia_dev'
            })

        this.analysisRules = {
            security: {
                patterns: [
                    {
                        id: 'sql_injection',
                        pattern: /\$\{[^}]*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/gi,
                        severity: 'high',
                        message: 'Potential SQL injection vulnerability detected',
                        suggestion: 'Use parameterized queries or prepared statements'
                    },
                    {
                        id: 'xss_vulnerability',
                        pattern: /innerHTML\s*=\s*[^;]*\+/gi,
                        severity: 'high',
                        message: 'Potential XSS vulnerability in innerHTML usage',
                        suggestion: 'Use textContent or sanitize HTML content'
                    },
                    {
                        id: 'hardcoded_secrets',
                        pattern: /(password|secret|key|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
                        severity: 'critical',
                        message: 'Hardcoded secret or password detected',
                        suggestion: 'Use environment variables or secure configuration'
                    },
                    {
                        id: 'eval_usage',
                        pattern: /\beval\s*\(/gi,
                        severity: 'high',
                        message: 'Use of eval() function detected',
                        suggestion: 'Avoid eval() - use safer alternatives like JSON.parse()'
                    }
                ]
            },
            performance: {
                patterns: [
                    {
                        id: 'inefficient_loop',
                        pattern: /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)\s*{[^}]*for\s*\(/gi,
                        severity: 'medium',
                        message: 'Nested loops detected - potential performance issue',
                        suggestion: 'Consider optimizing with better algorithms or data structures'
                    },
                    {
                        id: 'synchronous_operations',
                        pattern: /\.(readFileSync|writeFileSync|execSync)\(/gi,
                        severity: 'medium',
                        message: 'Synchronous file operations detected',
                        suggestion: 'Use asynchronous alternatives for better performance'
                    },
                    {
                        id: 'memory_leak_potential',
                        pattern: /setInterval\s*\([^}]*\}\s*,/gi,
                        severity: 'low',
                        message: 'setInterval without clearInterval detected',
                        suggestion: 'Ensure intervals are cleared to prevent memory leaks'
                    }
                ]
            },
            codeQuality: {
                patterns: [
                    {
                        id: 'missing_error_handling',
                        pattern: /(?:fetch|axios|request)\([^)]*\)(?!.*catch)/gi,
                        severity: 'medium',
                        message: 'HTTP request without error handling',
                        suggestion: 'Add proper error handling with try-catch or .catch()'
                    },
                    {
                        id: 'console_log_usage',
                        pattern: /console\.log\(/gi,
                        severity: 'low',
                        message: 'Console.log statements found',
                        suggestion: 'Remove debug statements or use proper logging'
                    },
                    {
                        id: 'magic_numbers',
                        pattern: /\b(?!0|1|2|10|100|1000)\d{3,}\b/g,
                        severity: 'low',
                        message: 'Magic numbers detected',
                        suggestion: 'Use named constants for better code readability'
                    },
                    {
                        id: 'long_functions',
                        pattern: /function[^{]*{(?:[^{}]*{[^{}]*})*[^{}]{200,}}/gi,
                        severity: 'medium',
                        message: 'Long function detected',
                        suggestion: 'Consider breaking down into smaller functions'
                    }
                ]
            },
            bestPractices: {
                patterns: [
                    {
                        id: 'var_usage',
                        pattern: /\bvar\s+/gi,
                        severity: 'low',
                        message: 'Use of var keyword detected',
                        suggestion: 'Use let or const instead of var for better scoping'
                    },
                    {
                        id: 'missing_strict_mode',
                        pattern: /^(?!.*['"]use strict['"])/m,
                        severity: 'low',
                        message: 'Missing strict mode declaration',
                        suggestion: 'Add "use strict"; at the beginning of your script'
                    },
                    {
                        id: 'callback_hell',
                        pattern: /\)\s*{[^}]*\)\s*{[^}]*\)\s*{[^}]*\)\s*{/gi,
                        severity: 'medium',
                        message: 'Callback hell pattern detected',
                        suggestion: 'Consider using Promises or async/await'
                    }
                ]
            }
        }

        this.languageSpecificRules = {
            javascript: {
                patterns: [
                    {
                        id: 'missing_semicolons',
                        pattern: /[^;{}]\s*\n/g,
                        severity: 'low',
                        message: 'Missing semicolons detected',
                        suggestion: 'Add semicolons for consistency and clarity'
                    },
                    {
                        id: 'arrow_function_optimization',
                        pattern: /function\s*\([^)]*\)\s*{\s*return\s+[^;]+;?\s*}/gi,
                        severity: 'low',
                        message: 'Function can be converted to arrow function',
                        suggestion: 'Consider using arrow functions for conciseness'
                    }
                ]
            },
            python: {
                patterns: [
                    {
                        id: 'missing_docstrings',
                        pattern: /def\s+\w+\([^)]*\):\s*\n(?!\s*['"""])/gi,
                        severity: 'low',
                        message: 'Function missing docstring',
                        suggestion: 'Add docstrings to document function purpose and parameters'
                    },
                    {
                        id: 'bare_except',
                        pattern: /except:\s*$/gm,
                        severity: 'medium',
                        message: 'Bare except clause detected',
                        suggestion: 'Specify exception types for better error handling'
                    }
                ]
            },
            java: {
                patterns: [
                    {
                        id: 'missing_access_modifiers',
                        pattern: /\n\s*(?:class|interface)\s+\w+/gi,
                        severity: 'low',
                        message: 'Missing access modifiers',
                        suggestion: 'Explicitly declare access modifiers (public, private, protected)'
                    }
                ]
            }
        }

        this.complexityMetrics = {
            cyclomaticComplexity: {
                patterns: [
                    /\bif\b/gi,
                    /\belse\b/gi,
                    /\bwhile\b/gi,
                    /\bfor\b/gi,
                    /\bswitch\b/gi,
                    /\bcase\b/gi,
                    /\bcatch\b/gi,
                    /\b&&\b/gi,
                    /\b\|\|\b/gi
                ]
            }
        }

        this.isInitialized = false
    }

    async initialize() {
        try {
            console.log('Initializing Code Analysis System...')

            // Test database connection
            await this.pool.query('SELECT 1')

            // Create analysis results table if it doesn't exist
            await this.createAnalysisTable()

            this.isInitialized = true
            console.log('Code Analysis System initialized successfully')
        } catch (error) {
            console.error('Failed to initialize Code Analysis System:', error)
            throw error
        }
    }

    async createAnalysisTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS code_analysis_results (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES code_sessions(id),
                task_id INTEGER REFERENCES code_tasks(id),
                code_content TEXT NOT NULL,
                language VARCHAR(50) NOT NULL,
                analysis_results JSONB NOT NULL,
                complexity_score INTEGER DEFAULT 0,
                quality_score INTEGER DEFAULT 0,
                security_score INTEGER DEFAULT 0,
                performance_score INTEGER DEFAULT 0,
                suggestions_count INTEGER DEFAULT 0,
                critical_issues_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_code_analysis_session ON code_analysis_results(session_id);
            CREATE INDEX IF NOT EXISTS idx_code_analysis_task ON code_analysis_results(task_id);
            CREATE INDEX IF NOT EXISTS idx_code_analysis_language ON code_analysis_results(language);
            CREATE INDEX IF NOT EXISTS idx_code_analysis_scores ON code_analysis_results(quality_score, security_score);
        `

        await this.pool.query(createTableQuery)
    }

    /**
     * Analyze code and provide suggestions
     */
    async analyzeCode({ code, language = 'javascript', sessionId = null, taskId = null, context = {} }) {
        try {
            console.log(`Analyzing ${language} code (${code.length} characters)`)

            const analysis = {
                language,
                timestamp: new Date().toISOString(),
                issues: [],
                suggestions: [],
                metrics: {},
                scores: {
                    overall: 0,
                    security: 100,
                    performance: 100,
                    quality: 100,
                    maintainability: 100
                }
            }

            // Run general analysis rules
            await this.runGeneralAnalysis(code, analysis)

            // Run language-specific analysis
            await this.runLanguageSpecificAnalysis(code, language, analysis)

            // Calculate complexity metrics
            await this.calculateComplexityMetrics(code, analysis)

            // Calculate scores
            this.calculateScores(analysis)

            // Generate improvement suggestions
            await this.generateImprovementSuggestions(code, analysis, context)

            // Store analysis results
            const analysisId = await this.storeAnalysisResults({
                sessionId,
                taskId,
                code,
                language,
                analysis
            })

            analysis.id = analysisId

            console.log(`Code analysis completed. Overall score: ${analysis.scores.overall}`)

            return analysis
        } catch (error) {
            console.error('Error analyzing code:', error)
            throw error
        }
    }

    async runGeneralAnalysis(code, analysis) {
        for (const [category, rules] of Object.entries(this.analysisRules)) {
            for (const rule of rules.patterns) {
                const matches = code.match(rule.pattern)

                if (matches) {
                    const issue = {
                        id: rule.id,
                        category,
                        severity: rule.severity,
                        message: rule.message,
                        suggestion: rule.suggestion,
                        occurrences: matches.length,
                        locations: this.findPatternLocations(code, rule.pattern)
                    }

                    analysis.issues.push(issue)

                    // Adjust scores based on severity
                    const scoreImpact = this.getSeverityImpact(rule.severity) * matches.length

                    switch (category) {
                        case 'security':
                            analysis.scores.security = Math.max(0, analysis.scores.security - scoreImpact)
                            break
                        case 'performance':
                            analysis.scores.performance = Math.max(0, analysis.scores.performance - scoreImpact)
                            break
                        case 'codeQuality':
                        case 'bestPractices':
                            analysis.scores.quality = Math.max(0, analysis.scores.quality - scoreImpact)
                            break
                    }
                }
            }
        }
    }

    async runLanguageSpecificAnalysis(code, language, analysis) {
        const languageRules = this.languageSpecificRules[language.toLowerCase()]

        if (!languageRules) {
            return
        }

        for (const rule of languageRules.patterns) {
            const matches = code.match(rule.pattern)

            if (matches) {
                const issue = {
                    id: rule.id,
                    category: 'language_specific',
                    severity: rule.severity,
                    message: rule.message,
                    suggestion: rule.suggestion,
                    occurrences: matches.length,
                    locations: this.findPatternLocations(code, rule.pattern)
                }

                analysis.issues.push(issue)

                const scoreImpact = this.getSeverityImpact(rule.severity) * matches.length
                analysis.scores.quality = Math.max(0, analysis.scores.quality - scoreImpact)
            }
        }
    }

    async calculateComplexityMetrics(code, analysis) {
        const metrics = {
            linesOfCode: code.split('\n').length,
            cyclomaticComplexity: 1, // Base complexity
            cognitiveComplexity: 0,
            nestingDepth: 0,
            functionCount: 0,
            classCount: 0
        }

        // Calculate cyclomatic complexity
        for (const pattern of this.complexityMetrics.cyclomaticComplexity.patterns) {
            const matches = code.match(pattern)
            if (matches) {
                metrics.cyclomaticComplexity += matches.length
            }
        }

        // Count functions and classes
        const functionMatches = code.match(/\bfunction\b|\b=>\b|\bdef\b/gi)
        if (functionMatches) {
            metrics.functionCount = functionMatches.length
        }

        const classMatches = code.match(/\bclass\b/gi)
        if (classMatches) {
            metrics.classCount = classMatches.length
        }

        // Calculate nesting depth
        metrics.nestingDepth = this.calculateNestingDepth(code)

        // Adjust maintainability score based on complexity
        if (metrics.cyclomaticComplexity > 10) {
            analysis.scores.maintainability -= (metrics.cyclomaticComplexity - 10) * 2
        }

        if (metrics.linesOfCode > 100) {
            analysis.scores.maintainability -= Math.floor((metrics.linesOfCode - 100) / 50) * 5
        }

        analysis.metrics = metrics
    }

    calculateNestingDepth(code) {
        let maxDepth = 0
        let currentDepth = 0

        for (let i = 0; i < code.length; i++) {
            if (code[i] === '{') {
                currentDepth++
                maxDepth = Math.max(maxDepth, currentDepth)
            } else if (code[i] === '}') {
                currentDepth--
            }
        }

        return maxDepth
    }

    calculateScores(analysis) {
        // Ensure scores don't go below 0
        analysis.scores.security = Math.max(0, analysis.scores.security)
        analysis.scores.performance = Math.max(0, analysis.scores.performance)
        analysis.scores.quality = Math.max(0, analysis.scores.quality)
        analysis.scores.maintainability = Math.max(0, analysis.scores.maintainability)

        // Calculate overall score
        analysis.scores.overall = Math.round(
            analysis.scores.security * 0.3 +
                analysis.scores.performance * 0.25 +
                analysis.scores.quality * 0.25 +
                analysis.scores.maintainability * 0.2
        )
    }

    async generateImprovementSuggestions(code, analysis, context) {
        const suggestions = []

        // Generate suggestions based on issues found
        const criticalIssues = analysis.issues.filter((issue) => issue.severity === 'critical')
        const highIssues = analysis.issues.filter((issue) => issue.severity === 'high')

        if (criticalIssues.length > 0) {
            suggestions.push({
                type: 'security',
                priority: 'critical',
                title: 'Critical Security Issues Detected',
                description: `Found ${criticalIssues.length} critical security issues that need immediate attention.`,
                actions: criticalIssues.map((issue) => issue.suggestion)
            })
        }

        if (highIssues.length > 0) {
            suggestions.push({
                type: 'security',
                priority: 'high',
                title: 'High Priority Security Issues',
                description: `Found ${highIssues.length} high priority security issues.`,
                actions: highIssues.map((issue) => issue.suggestion)
            })
        }

        // Performance suggestions
        if (analysis.scores.performance < 80) {
            suggestions.push({
                type: 'performance',
                priority: 'medium',
                title: 'Performance Optimization Opportunities',
                description: 'Code could benefit from performance optimizations.',
                actions: [
                    'Review nested loops and consider algorithmic improvements',
                    'Use asynchronous operations where appropriate',
                    'Consider caching frequently accessed data',
                    'Optimize database queries and API calls'
                ]
            })
        }

        // Code quality suggestions
        if (analysis.scores.quality < 80) {
            suggestions.push({
                type: 'quality',
                priority: 'medium',
                title: 'Code Quality Improvements',
                description: 'Code quality can be enhanced with better practices.',
                actions: [
                    'Add comprehensive error handling',
                    'Improve code documentation and comments',
                    'Use consistent naming conventions',
                    'Break down large functions into smaller ones'
                ]
            })
        }

        // Maintainability suggestions
        if (analysis.scores.maintainability < 80) {
            suggestions.push({
                type: 'maintainability',
                priority: 'low',
                title: 'Maintainability Enhancements',
                description: 'Code maintainability can be improved.',
                actions: [
                    'Reduce code complexity and nesting depth',
                    'Extract reusable components and utilities',
                    'Add unit tests for better code coverage',
                    'Use design patterns for better structure'
                ]
            })
        }

        analysis.suggestions = suggestions
    }

    findPatternLocations(code, pattern) {
        const locations = []
        const lines = code.split('\n')

        lines.forEach((line, index) => {
            const matches = line.match(pattern)
            if (matches) {
                locations.push({
                    line: index + 1,
                    column: line.indexOf(matches[0]) + 1,
                    length: matches[0].length
                })
            }
        })

        return locations
    }

    getSeverityImpact(severity) {
        const impacts = {
            critical: 25,
            high: 15,
            medium: 8,
            low: 3
        }

        return impacts[severity] || 5
    }

    async storeAnalysisResults({ sessionId, taskId, code, language, analysis }) {
        try {
            const query = `
                INSERT INTO code_analysis_results (
                    session_id, task_id, code_content, language, analysis_results,
                    complexity_score, quality_score, security_score, performance_score,
                    suggestions_count, critical_issues_count
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
            `

            const criticalIssues = analysis.issues.filter((issue) => issue.severity === 'critical').length

            const values = [
                sessionId,
                taskId,
                code,
                language,
                JSON.stringify(analysis),
                analysis.metrics.cyclomaticComplexity || 0,
                analysis.scores.quality || 0,
                analysis.scores.security || 0,
                analysis.scores.performance || 0,
                analysis.suggestions.length || 0,
                criticalIssues
            ]

            const result = await this.pool.query(query, values)
            return result.rows[0].id
        } catch (error) {
            console.error('Error storing analysis results:', error)
            throw error
        }
    }

    /**
     * Get analysis history for a session
     */
    async getSessionAnalysisHistory(sessionId, limit = 10) {
        try {
            const query = `
                SELECT 
                    id, task_id, language, complexity_score, quality_score,
                    security_score, performance_score, suggestions_count,
                    critical_issues_count, created_at
                FROM code_analysis_results
                WHERE session_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `

            const result = await this.pool.query(query, [sessionId, limit])
            return result.rows
        } catch (error) {
            console.error('Error getting session analysis history:', error)
            throw error
        }
    }

    /**
     * Get analysis statistics
     */
    async getAnalysisStatistics(timeRange = '7d') {
        try {
            const timeRangeMs = {
                '1d': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000
            }

            const rangeMs = timeRangeMs[timeRange] || timeRangeMs['7d']
            const startTime = new Date(Date.now() - rangeMs)

            const query = `
                SELECT 
                    COUNT(*) as total_analyses,
                    AVG(quality_score) as avg_quality_score,
                    AVG(security_score) as avg_security_score,
                    AVG(performance_score) as avg_performance_score,
                    AVG(complexity_score) as avg_complexity_score,
                    SUM(critical_issues_count) as total_critical_issues,
                    language,
                    COUNT(*) as language_count
                FROM code_analysis_results
                WHERE created_at >= $1
                GROUP BY language
                ORDER BY language_count DESC
            `

            const result = await this.pool.query(query, [startTime])

            return {
                timeRange,
                period: {
                    start: startTime.toISOString(),
                    end: new Date().toISOString()
                },
                statistics: result.rows
            }
        } catch (error) {
            console.error('Error getting analysis statistics:', error)
            throw error
        }
    }

    /**
     * Get detailed analysis by ID
     */
    async getAnalysisById(analysisId) {
        try {
            const query = `
                SELECT *
                FROM code_analysis_results
                WHERE id = $1
            `

            const result = await this.pool.query(query, [analysisId])

            if (result.rows.length === 0) {
                throw new Error(`Analysis with ID ${analysisId} not found`)
            }

            const analysis = result.rows[0]
            analysis.analysis_results = JSON.parse(analysis.analysis_results)

            return analysis
        } catch (error) {
            console.error('Error getting analysis by ID:', error)
            throw error
        }
    }

    /**
     * Shutdown the analysis system
     */
    async shutdown() {
        try {
            console.log('Shutting down Code Analysis System...')

            if (this.pool) {
                await this.pool.end()
            }

            this.isInitialized = false
            console.log('Code Analysis System shut down successfully')
        } catch (error) {
            console.error('Error shutting down Code Analysis System:', error)
            throw error
        }
    }
}

module.exports = { CodeAnalysisSystem }
