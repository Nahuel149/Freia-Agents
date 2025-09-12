/**
 * CodeAgent Definitions - Defines different types of code agents and their capabilities
 * Adapted from B2B Sales Agent definitions for code development workflows
 */
class CodeAgentDefinitions {
    constructor(dbPool) {
        this.pool = dbPool;
        this.agentTypes = new Map();
        this.workflows = new Map();
        this.integrationPoints = new Map();
        this.isInitialized = false;
    }
    
    /**
     * Initialize all agent definitions and workflows
     */
    async initialize() {
        try {
            console.log('Initializing CodeAgent Definitions...');
            
            this.initializeAgentTypes();
            this.initializeWorkflows();
            this.initializeIntegrationPoints();
            
            this.isInitialized = true;
            console.log('CodeAgent Definitions initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize CodeAgent Definitions:', error);
            throw error;
        }
    }
    
    /**
     * Initialize different types of code agents
     */
    initializeAgentTypes() {
        // Main Code Generation Agent
        this.agentTypes.set('main_code_agent', {
            id: 'main_code_agent',
            name: 'Main Code Generator',
            role: 'primary_generator',
            description: 'Primary agent responsible for generating core application code',
            capabilities: [
                'code_generation',
                'architecture_design',
                'best_practices_implementation',
                'framework_integration',
                'dependency_management'
            ],
            supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
            supportedFrameworks: ['express', 'react', 'vue', 'angular', 'flask', 'django', 'spring'],
            priority: 1,
            timeout: 45000,
            estimatedDuration: 30000,
            apiType: 'flowise',
            flowiseEndpoint: '/api/v1/prediction/code-generation-main',
            context: {
                systemPrompt: 'You are an expert software developer specializing in clean, maintainable code generation.',
                temperature: 0.3,
                maxTokens: 4000
            }
        });
        
        // Debugging and Error Fixing Agent
        this.agentTypes.set('debugging_agent', {
            id: 'debugging_agent',
            name: 'Code Debugger',
            role: 'error_resolver',
            description: 'Specialized agent for identifying and fixing code issues',
            capabilities: [
                'error_detection',
                'bug_fixing',
                'performance_debugging',
                'memory_leak_detection',
                'security_vulnerability_scanning'
            ],
            supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go'],
            priority: 2,
            timeout: 30000,
            estimatedDuration: 20000,
            apiType: 'flowise',
            flowiseEndpoint: '/api/v1/prediction/code-debugging',
            context: {
                systemPrompt: 'You are a debugging expert who can identify and fix complex code issues.',
                temperature: 0.2,
                maxTokens: 3000
            }
        });
        
        // Code Optimization Agent
        this.agentTypes.set('optimization_agent', {
            id: 'optimization_agent',
            name: 'Code Optimizer',
            role: 'performance_enhancer',
            description: 'Agent focused on optimizing code performance and efficiency',
            capabilities: [
                'performance_optimization',
                'code_refactoring',
                'algorithm_improvement',
                'memory_optimization',
                'database_query_optimization'
            ],
            supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
            priority: 3,
            timeout: 35000,
            estimatedDuration: 25000,
            apiType: 'flowise',
            flowiseEndpoint: '/api/v1/prediction/code-optimization',
            context: {
                systemPrompt: 'You are a performance optimization expert focused on efficient, scalable code.',
                temperature: 0.4,
                maxTokens: 3500
            }
        });
        
        // Testing Agent
        this.agentTypes.set('testing_agent', {
            id: 'testing_agent',
            name: 'Test Generator',
            role: 'quality_assurance',
            description: 'Agent specialized in generating comprehensive tests',
            capabilities: [
                'unit_test_generation',
                'integration_test_creation',
                'test_coverage_analysis',
                'mock_data_generation',
                'e2e_test_scenarios'
            ],
            supportedLanguages: ['javascript', 'typescript', 'python', 'java'],
            supportedFrameworks: ['jest', 'mocha', 'pytest', 'junit', 'cypress'],
            priority: 4,
            timeout: 25000,
            estimatedDuration: 15000,
            apiType: 'flowise',
            flowiseEndpoint: '/api/v1/prediction/test-generation',
            context: {
                systemPrompt: 'You are a testing expert who creates comprehensive, reliable test suites.',
                temperature: 0.3,
                maxTokens: 2500
            }
        });
        
        // Documentation Agent
        this.agentTypes.set('documentation_agent', {
            id: 'documentation_agent',
            name: 'Documentation Generator',
            role: 'documentation_specialist',
            description: 'Agent focused on generating clear, comprehensive documentation',
            capabilities: [
                'api_documentation',
                'code_comments',
                'readme_generation',
                'technical_specifications',
                'user_guides'
            ],
            supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
            priority: 5,
            timeout: 20000,
            estimatedDuration: 12000,
            apiType: 'flowise',
            flowiseEndpoint: '/api/v1/prediction/documentation-generation',
            context: {
                systemPrompt: 'You are a technical writer who creates clear, comprehensive documentation.',
                temperature: 0.5,
                maxTokens: 2000
            }
        });
        
        // Security Analysis Agent
        this.agentTypes.set('security_agent', {
            id: 'security_agent',
            name: 'Security Analyzer',
            role: 'security_specialist',
            description: 'Agent specialized in security analysis and vulnerability detection',
            capabilities: [
                'vulnerability_scanning',
                'security_best_practices',
                'authentication_implementation',
                'data_encryption',
                'secure_coding_patterns'
            ],
            supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go'],
            priority: 6,
            timeout: 30000,
            estimatedDuration: 18000,
            apiType: 'flowise',
            flowiseEndpoint: '/api/v1/prediction/security-analysis',
            context: {
                systemPrompt: 'You are a cybersecurity expert focused on secure code development.',
                temperature: 0.2,
                maxTokens: 3000
            }
        });
        
        console.log(`Initialized ${this.agentTypes.size} agent types`);
    }
    
    /**
     * Initialize workflow definitions for different scenarios
     */
    initializeWorkflows() {
        // Simple Code Generation Workflow
        this.workflows.set('simple_generation', {
            id: 'simple_generation',
            name: 'Simple Code Generation',
            description: 'Basic code generation for simple tasks',
            complexity: 'simple',
            agents: ['main_code_agent'],
            estimatedDuration: 30000,
            successCriteria: {
                minQualityScore: 6.0,
                requiredCapabilities: ['code_generation']
            }
        });
        
        // Full Development Workflow
        this.workflows.set('full_development', {
            id: 'full_development',
            name: 'Full Development Cycle',
            description: 'Complete development workflow with testing and documentation',
            complexity: 'complex',
            agents: ['main_code_agent', 'testing_agent', 'documentation_agent'],
            estimatedDuration: 75000,
            successCriteria: {
                minQualityScore: 7.5,
                requiredCapabilities: ['code_generation', 'unit_test_generation', 'api_documentation']
            }
        });
        
        // Debug and Fix Workflow
        this.workflows.set('debug_fix', {
            id: 'debug_fix',
            name: 'Debug and Fix',
            description: 'Workflow for debugging and fixing existing code',
            complexity: 'medium',
            agents: ['debugging_agent', 'testing_agent'],
            estimatedDuration: 50000,
            successCriteria: {
                minQualityScore: 7.0,
                requiredCapabilities: ['error_detection', 'bug_fixing']
            }
        });
        
        // Optimization Workflow
        this.workflows.set('optimization', {
            id: 'optimization',
            name: 'Code Optimization',
            description: 'Workflow for optimizing existing code performance',
            complexity: 'medium',
            agents: ['optimization_agent', 'testing_agent'],
            estimatedDuration: 60000,
            successCriteria: {
                minQualityScore: 7.5,
                requiredCapabilities: ['performance_optimization', 'code_refactoring']
            }
        });
        
        // Enterprise Development Workflow
        this.workflows.set('enterprise_development', {
            id: 'enterprise_development',
            name: 'Enterprise Development',
            description: 'Comprehensive workflow for enterprise-grade applications',
            complexity: 'enterprise',
            agents: ['main_code_agent', 'security_agent', 'testing_agent', 'optimization_agent', 'documentation_agent'],
            estimatedDuration: 150000,
            successCriteria: {
                minQualityScore: 8.5,
                requiredCapabilities: [
                    'code_generation', 'security_best_practices', 'unit_test_generation',
                    'performance_optimization', 'api_documentation'
                ]
            }
        });
        
        console.log(`Initialized ${this.workflows.size} workflows`);
    }
    
    /**
     * Initialize integration points with external systems
     */
    initializeIntegrationPoints() {
        // Flowise Integration
        this.integrationPoints.set('flowise', {
            id: 'flowise',
            name: 'Flowise AI Platform',
            type: 'ai_platform',
            baseUrl: process.env.FLOWISE_API_URL || 'http://localhost:3000',
            authentication: {
                type: 'api_key',
                key: process.env.FLOWISE_API_KEY
            },
            endpoints: {
                codeGeneration: '/api/v1/prediction/code-generation-main',
                debugging: '/api/v1/prediction/code-debugging',
                optimization: '/api/v1/prediction/code-optimization',
                testing: '/api/v1/prediction/test-generation',
                documentation: '/api/v1/prediction/documentation-generation',
                security: '/api/v1/prediction/security-analysis'
            }
        });
        
        // Direct CodeAgent Integration
        this.integrationPoints.set('codeagent_direct', {
            id: 'codeagent_direct',
            name: 'Direct CodeAgent API',
            type: 'internal_api',
            baseUrl: process.env.CODE_AGENT_API_URL || 'http://localhost:8080',
            endpoints: {
                execute: '/api/codeagents/execute',
                create: '/api/codeagents',
                update: '/api/codeagents',
                delete: '/api/codeagents'
            }
        });
        
        // GitHub Integration (for code analysis)
        this.integrationPoints.set('github', {
            id: 'github',
            name: 'GitHub API',
            type: 'external_api',
            baseUrl: 'https://api.github.com',
            authentication: {
                type: 'token',
                token: process.env.GITHUB_TOKEN
            },
            endpoints: {
                repos: '/repos',
                contents: '/repos/{owner}/{repo}/contents/{path}',
                commits: '/repos/{owner}/{repo}/commits'
            }
        });
        
        console.log(`Initialized ${this.integrationPoints.size} integration points`);
    }
    
    /**
     * Get agents suitable for a specific task
     */
    async getAgentsForTask(taskType, complexity, language) {
        try {
            // Determine workflow based on task type and complexity
            const workflow = this.determineWorkflow(taskType, complexity);
            
            if (!workflow) {
                throw new Error(`No workflow found for task type: ${taskType}, complexity: ${complexity}`);
            }
            
            // Get agents for this workflow
            const agents = workflow.agents.map(agentId => {
                const agent = this.agentTypes.get(agentId);
                if (!agent) {
                    throw new Error(`Agent type not found: ${agentId}`);
                }
                
                // Check language support
                if (language && agent.supportedLanguages && !agent.supportedLanguages.includes(language)) {
                    console.warn(`Agent ${agent.name} does not support language: ${language}`);
                }
                
                return { ...agent };
            }).filter(agent => agent); // Remove any null agents
            
            // Sort by priority
            agents.sort((a, b) => a.priority - b.priority);
            
            console.log(`Selected ${agents.length} agents for task:`, {
                taskType,
                complexity,
                language,
                workflow: workflow.id,
                agents: agents.map(a => a.name)
            });
            
            return agents;
            
        } catch (error) {
            console.error('Error getting agents for task:', error);
            throw error;
        }
    }
    
    /**
     * Determine appropriate workflow based on task parameters
     */
    determineWorkflow(taskType, complexity) {
        // Task type to workflow mapping
        const taskWorkflowMap = {
            'generation': {
                'simple': 'simple_generation',
                'medium': 'full_development',
                'complex': 'full_development',
                'enterprise': 'enterprise_development'
            },
            'debugging': {
                'simple': 'debug_fix',
                'medium': 'debug_fix',
                'complex': 'debug_fix',
                'enterprise': 'debug_fix'
            },
            'optimization': {
                'simple': 'optimization',
                'medium': 'optimization',
                'complex': 'optimization',
                'enterprise': 'enterprise_development'
            },
            'testing': {
                'simple': 'simple_generation',
                'medium': 'full_development',
                'complex': 'full_development',
                'enterprise': 'enterprise_development'
            },
            'documentation': {
                'simple': 'simple_generation',
                'medium': 'full_development',
                'complex': 'full_development',
                'enterprise': 'enterprise_development'
            }
        };
        
        const workflowId = taskWorkflowMap[taskType]?.[complexity] || 'simple_generation';
        return this.workflows.get(workflowId);
    }
    
    /**
     * Get agent configuration by ID
     */
    getAgentConfig(agentId) {
        return this.agentTypes.get(agentId);
    }
    
    /**
     * Get workflow configuration by ID
     */
    getWorkflowConfig(workflowId) {
        return this.workflows.get(workflowId);
    }
    
    /**
     * Get integration point configuration by ID
     */
    getIntegrationConfig(integrationId) {
        return this.integrationPoints.get(integrationId);
    }
    
    /**
     * Get all available agent types
     */
    getAllAgentTypes() {
        return Array.from(this.agentTypes.values());
    }
    
    /**
     * Get all available workflows
     */
    getAllWorkflows() {
        return Array.from(this.workflows.values());
    }
    
    /**
     * Get agents by capability
     */
    getAgentsByCapability(capability) {
        return Array.from(this.agentTypes.values())
            .filter(agent => agent.capabilities.includes(capability));
    }
    
    /**
     * Get agents by supported language
     */
    getAgentsByLanguage(language) {
        return Array.from(this.agentTypes.values())
            .filter(agent => !agent.supportedLanguages || agent.supportedLanguages.includes(language));
    }
    
    /**
     * Get agents by supported framework
     */
    getAgentsByFramework(framework) {
        return Array.from(this.agentTypes.values())
            .filter(agent => !agent.supportedFrameworks || agent.supportedFrameworks.includes(framework));
    }
    
    /**
     * Update agent configuration
     */
    updateAgentConfig(agentId, updates) {
        const agent = this.agentTypes.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        
        const updatedAgent = { ...agent, ...updates };
        this.agentTypes.set(agentId, updatedAgent);
        
        console.log(`Updated agent configuration: ${agentId}`);
        return updatedAgent;
    }
    
    /**
     * Add custom agent type
     */
    addCustomAgent(agentConfig) {
        if (!agentConfig.id || !agentConfig.name) {
            throw new Error('Agent must have id and name');
        }
        
        if (this.agentTypes.has(agentConfig.id)) {
            throw new Error(`Agent already exists: ${agentConfig.id}`);
        }
        
        this.agentTypes.set(agentConfig.id, agentConfig);
        console.log(`Added custom agent: ${agentConfig.id}`);
        
        return agentConfig;
    }
    
    /**
     * Add custom workflow
     */
    addCustomWorkflow(workflowConfig) {
        if (!workflowConfig.id || !workflowConfig.name) {
            throw new Error('Workflow must have id and name');
        }
        
        if (this.workflows.has(workflowConfig.id)) {
            throw new Error(`Workflow already exists: ${workflowConfig.id}`);
        }
        
        // Validate that all agents in workflow exist
        for (const agentId of workflowConfig.agents || []) {
            if (!this.agentTypes.has(agentId)) {
                throw new Error(`Agent not found in workflow: ${agentId}`);
            }
        }
        
        this.workflows.set(workflowConfig.id, workflowConfig);
        console.log(`Added custom workflow: ${workflowConfig.id}`);
        
        return workflowConfig;
    }
    
    /**
     * Get statistics about agent definitions
     */
    getStatistics() {
        const agentsByRole = {};
        const agentsByLanguage = {};
        const workflowsByComplexity = {};
        
        // Count agents by role
        for (const agent of this.agentTypes.values()) {
            agentsByRole[agent.role] = (agentsByRole[agent.role] || 0) + 1;
            
            // Count by supported languages
            if (agent.supportedLanguages) {
                for (const lang of agent.supportedLanguages) {
                    agentsByLanguage[lang] = (agentsByLanguage[lang] || 0) + 1;
                }
            }
        }
        
        // Count workflows by complexity
        for (const workflow of this.workflows.values()) {
            workflowsByComplexity[workflow.complexity] = (workflowsByComplexity[workflow.complexity] || 0) + 1;
        }
        
        return {
            totalAgents: this.agentTypes.size,
            totalWorkflows: this.workflows.size,
            totalIntegrations: this.integrationPoints.size,
            agentsByRole,
            agentsByLanguage,
            workflowsByComplexity
        };
    }
}

module.exports = { CodeAgentDefinitions };