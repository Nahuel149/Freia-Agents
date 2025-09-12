/**
 * CodeAgent Orchestration System Test Suite
 * Comprehensive testing of the complete orchestration system with real scenarios
 */
const { CodeAgentIntegrationLayer } = require('./code-integration-layer');
const { CodeAnalysisSystem } = require('./code-analysis-system');
const { Pool } = require('pg');

class OrchestrationSystemTester {
    constructor() {
        this.integrationLayer = null;
        this.analysisSystem = null;
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
        
        this.testScenarios = [
            {
                name: 'Simple JavaScript Function Generation',
                type: 'code_generation',
                input: {
                    userId: 'test-user-1',
                    prompt: 'Create a function that calculates the factorial of a number',
                    language: 'javascript',
                    complexity: 'simple'
                },
                expectedOutputs: {
                    hasCode: true,
                    hasExplanation: true,
                    codeContains: ['function', 'factorial', 'return'],
                    analysisScore: 70
                }
            },
            {
                name: 'React Component with State Management',
                type: 'code_generation',
                input: {
                    userId: 'test-user-2',
                    prompt: 'Create a React component for a todo list with add, delete, and toggle functionality',
                    language: 'javascript',
                    framework: 'react',
                    complexity: 'medium'
                },
                expectedOutputs: {
                    hasCode: true,
                    hasExplanation: true,
                    codeContains: ['useState', 'component', 'todo'],
                    analysisScore: 60
                }
            },
            {
                name: 'Python Data Processing Script',
                type: 'code_generation',
                input: {
                    userId: 'test-user-3',
                    prompt: 'Create a Python script that reads a CSV file and calculates statistics',
                    language: 'python',
                    complexity: 'medium',
                    requirements: ['pandas', 'error handling', 'documentation']
                },
                expectedOutputs: {
                    hasCode: true,
                    hasExplanation: true,
                    codeContains: ['pandas', 'csv', 'statistics'],
                    analysisScore: 65
                }
            },
            {
                name: 'Full Stack API with Database',
                type: 'code_generation',
                input: {
                    userId: 'test-user-4',
                    prompt: 'Create a REST API for user management with CRUD operations and database integration',
                    language: 'javascript',
                    framework: 'express',
                    complexity: 'complex',
                    requirements: ['authentication', 'validation', 'error handling', 'database']
                },
                expectedOutputs: {
                    hasCode: true,
                    hasExplanation: true,
                    codeContains: ['express', 'router', 'database', 'auth'],
                    analysisScore: 50
                }
            },
            {
                name: 'Code Debugging and Optimization',
                type: 'code_improvement',
                input: {
                    userId: 'test-user-5',
                    prompt: 'Debug and optimize this slow sorting algorithm',
                    language: 'javascript',
                    context: {
                        existingCode: `
                            function slowSort(arr) {
                                for (let i = 0; i < arr.length; i++) {
                                    for (let j = 0; j < arr.length; j++) {
                                        for (let k = 0; k < arr.length; k++) {
                                            if (arr[k] > arr[k + 1]) {
                                                let temp = arr[k];
                                                arr[k] = arr[k + 1];
                                                arr[k + 1] = temp;
                                            }
                                        }
                                    }
                                }
                                return arr;
                            }
                        `
                    },
                    complexity: 'medium'
                },
                expectedOutputs: {
                    hasCode: true,
                    hasExplanation: true,
                    hasImprovements: true,
                    analysisScore: 80
                }
            }
        ];
    }
    
    async initialize() {
        try {
            console.log('\n🚀 Initializing CodeAgent Orchestration System Test Suite...');
            
            // Initialize integration layer
            this.integrationLayer = new CodeAgentIntegrationLayer();
            await this.integrationLayer.initialize();
            
            // Initialize analysis system
            this.analysisSystem = new CodeAnalysisSystem();
            await this.analysisSystem.initialize();
            
            console.log('✅ Test suite initialized successfully\n');
            
        } catch (error) {
            console.error('❌ Failed to initialize test suite:', error);
            throw error;
        }
    }
    
    async runAllTests() {
        try {
            console.log('🧪 Starting comprehensive orchestration system tests...\n');
            
            // Run system health checks first
            await this.runHealthChecks();
            
            // Run database connectivity tests
            await this.runDatabaseTests();
            
            // Run component integration tests
            await this.runComponentTests();
            
            // Run scenario-based tests
            await this.runScenarioTests();
            
            // Run performance tests
            await this.runPerformanceTests();
            
            // Run error handling tests
            await this.runErrorHandlingTests();
            
            // Generate final report
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test suite execution failed:', error);
            throw error;
        }
    }
    
    async runHealthChecks() {
        console.log('🏥 Running system health checks...');
        
        await this.runTest('Integration Layer Health Check', async () => {
            if (!this.integrationLayer.isInitialized) {
                throw new Error('Integration layer not initialized');
            }
            
            const status = this.integrationLayer.getStatus();
            if (!status.initialized) {
                throw new Error('Integration layer status shows not initialized');
            }
            
            return { status: 'healthy', details: status };
        });
        
        await this.runTest('Analysis System Health Check', async () => {
            if (!this.analysisSystem.isInitialized) {
                throw new Error('Analysis system not initialized');
            }
            
            return { status: 'healthy' };
        });
        
        await this.runTest('Orchestrator Health Check', async () => {
            if (!this.integrationLayer.orchestrator) {
                throw new Error('Orchestrator not available');
            }
            
            if (!this.integrationLayer.orchestrator.isInitialized) {
                throw new Error('Orchestrator not initialized');
            }
            
            return { status: 'healthy' };
        });
    }
    
    async runDatabaseTests() {
        console.log('🗄️ Running database connectivity tests...');
        
        await this.runTest('Database Connection Test', async () => {
            const result = await this.integrationLayer.pool.query('SELECT 1 as test');
            if (result.rows[0].test !== 1) {
                throw new Error('Database query returned unexpected result');
            }
            return { connected: true };
        });
        
        await this.runTest('Database Schema Validation', async () => {
            const tables = ['code_sessions', 'code_tasks', 'code_followups', 'code_analysis_results'];
            const results = {};
            
            for (const table of tables) {
                const result = await this.integrationLayer.pool.query(
                    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
                    [table]
                );
                results[table] = result.rows[0].exists;
                
                if (!result.rows[0].exists) {
                    throw new Error(`Required table '${table}' does not exist`);
                }
            }
            
            return { tables: results };
        });
    }
    
    async runComponentTests() {
        console.log('🔧 Running component integration tests...');
        
        await this.runTest('Session Creation Test', async () => {
            const session = await this.integrationLayer.createOrGetSession({
                userId: 'test-component-user',
                language: 'javascript',
                framework: 'react',
                context: { test: true }
            });
            
            if (!session.id || !session.user_id) {
                throw new Error('Session creation failed - missing required fields');
            }
            
            return { sessionId: session.id, userId: session.user_id };
        });
        
        await this.runTest('Agent Definitions Loading Test', async () => {
            const agentDefinitions = this.integrationLayer.orchestrator.agentDefinitions;
            
            if (!agentDefinitions.agentTypes || Object.keys(agentDefinitions.agentTypes).length === 0) {
                throw new Error('Agent types not loaded');
            }
            
            if (!agentDefinitions.workflows || Object.keys(agentDefinitions.workflows).length === 0) {
                throw new Error('Workflows not loaded');
            }
            
            return {
                agentTypesCount: Object.keys(agentDefinitions.agentTypes).length,
                workflowsCount: Object.keys(agentDefinitions.workflows).length
            };
        });
        
        await this.runTest('Follow-up System Test', async () => {
            const followUpSystem = this.integrationLayer.orchestrator.followUpSystem;
            
            if (!followUpSystem.isInitialized) {
                throw new Error('Follow-up system not initialized');
            }
            
            // Test scheduling a follow-up
            const followUp = await followUpSystem.scheduleFollowUp({
                sessionId: 1,
                type: 'code_review',
                priority: 'low',
                context: { test: true }
            });
            
            if (!followUp.id) {
                throw new Error('Follow-up scheduling failed');
            }
            
            return { followUpId: followUp.id, type: followUp.followup_type };
        });
    }
    
    async runScenarioTests() {
        console.log('📋 Running scenario-based tests...');
        
        for (const scenario of this.testScenarios) {
            await this.runTest(`Scenario: ${scenario.name}`, async () => {
                const result = await this.integrationLayer.generateCodeWithOrchestration(scenario.input);
                
                // Validate expected outputs
                const validation = this.validateScenarioResult(result, scenario.expectedOutputs);
                
                if (!validation.isValid) {
                    throw new Error(`Scenario validation failed: ${validation.errors.join(', ')}`);
                }
                
                return {
                    sessionId: result.sessionId,
                    taskId: result.taskId,
                    codeLength: result.code?.length || 0,
                    hasAnalysis: !!result.analysis,
                    validationScore: validation.score
                };
            });
        }
    }
    
    async runPerformanceTests() {
        console.log('⚡ Running performance tests...');
        
        await this.runTest('Code Generation Performance Test', async () => {
            const startTime = Date.now();
            
            const result = await this.integrationLayer.generateCodeWithOrchestration({
                userId: 'perf-test-user',
                prompt: 'Create a simple hello world function',
                language: 'javascript',
                complexity: 'simple'
            });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Performance should be under 30 seconds for simple requests
            if (duration > 30000) {
                throw new Error(`Performance test failed: took ${duration}ms (>30s)`);
            }
            
            return {
                duration: duration,
                sessionId: result.sessionId,
                performance: duration < 10000 ? 'excellent' : duration < 20000 ? 'good' : 'acceptable'
            };
        });
        
        await this.runTest('Concurrent Request Handling Test', async () => {
            const concurrentRequests = 3;
            const promises = [];
            
            for (let i = 0; i < concurrentRequests; i++) {
                promises.push(
                    this.integrationLayer.generateCodeWithOrchestration({
                        userId: `concurrent-test-user-${i}`,
                        prompt: `Create a function that adds two numbers - request ${i}`,
                        language: 'javascript',
                        complexity: 'simple'
                    })
                );
            }
            
            const startTime = Date.now();
            const results = await Promise.all(promises);
            const endTime = Date.now();
            
            const duration = endTime - startTime;
            
            // All requests should complete successfully
            if (results.some(result => !result.code)) {
                throw new Error('Some concurrent requests failed');
            }
            
            return {
                concurrentRequests,
                totalDuration: duration,
                averageDuration: duration / concurrentRequests,
                allSuccessful: true
            };
        });
    }
    
    async runErrorHandlingTests() {
        console.log('🚨 Running error handling tests...');
        
        await this.runTest('Invalid Input Handling Test', async () => {
            try {
                await this.integrationLayer.generateCodeWithOrchestration({
                    // Missing required fields
                    prompt: 'Test prompt'
                });
                
                throw new Error('Should have thrown an error for invalid input');
            } catch (error) {
                if (error.message.includes('Should have thrown')) {
                    throw error;
                }
                
                // Expected error - test passed
                return { errorHandled: true, errorMessage: error.message };
            }
        });
        
        await this.runTest('Database Connection Error Handling', async () => {
            // Temporarily break database connection
            const originalPool = this.integrationLayer.pool;
            this.integrationLayer.pool = {
                query: () => Promise.reject(new Error('Database connection failed'))
            };
            
            try {
                await this.integrationLayer.createOrGetSession({
                    userId: 'error-test-user',
                    language: 'javascript'
                });
                
                throw new Error('Should have thrown a database error');
            } catch (error) {
                if (error.message.includes('Should have thrown')) {
                    throw error;
                }
                
                // Restore original pool
                this.integrationLayer.pool = originalPool;
                
                return { errorHandled: true, errorType: 'database_connection' };
            }
        });
    }
    
    validateScenarioResult(result, expectedOutputs) {
        const validation = {
            isValid: true,
            errors: [],
            score: 0
        };
        
        let checks = 0;
        let passed = 0;
        
        // Check if code exists
        if (expectedOutputs.hasCode) {
            checks++;
            if (result.code && result.code.length > 0) {
                passed++;
            } else {
                validation.errors.push('Missing code output');
            }
        }
        
        // Check if explanation exists
        if (expectedOutputs.hasExplanation) {
            checks++;
            if (result.explanation && result.explanation.length > 0) {
                passed++;
            } else {
                validation.errors.push('Missing explanation');
            }
        }
        
        // Check if code contains expected elements
        if (expectedOutputs.codeContains && result.code) {
            for (const element of expectedOutputs.codeContains) {
                checks++;
                if (result.code.toLowerCase().includes(element.toLowerCase())) {
                    passed++;
                } else {
                    validation.errors.push(`Code missing expected element: ${element}`);
                }
            }
        }
        
        // Check analysis score
        if (expectedOutputs.analysisScore && result.analysis) {
            checks++;
            if (result.analysis.scores && result.analysis.scores.overall >= expectedOutputs.analysisScore) {
                passed++;
            } else {
                validation.errors.push(`Analysis score below expected: ${result.analysis.scores?.overall || 0} < ${expectedOutputs.analysisScore}`);
            }
        }
        
        // Check for improvements (for debugging scenarios)
        if (expectedOutputs.hasImprovements) {
            checks++;
            if (result.improvements && result.improvements.length > 0) {
                passed++;
            } else {
                validation.errors.push('Missing code improvements');
            }
        }
        
        validation.score = checks > 0 ? (passed / checks) * 100 : 0;
        validation.isValid = validation.errors.length === 0;
        
        return validation;
    }
    
    async runTest(testName, testFunction) {
        this.testResults.total++;
        
        try {
            console.log(`  🧪 Running: ${testName}`);
            const startTime = Date.now();
            
            const result = await testFunction();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            this.testResults.passed++;
            this.testResults.details.push({
                name: testName,
                status: 'PASSED',
                duration: duration,
                result: result
            });
            
            console.log(`  ✅ PASSED: ${testName} (${duration}ms)`);
            
        } catch (error) {
            this.testResults.failed++;
            this.testResults.details.push({
                name: testName,
                status: 'FAILED',
                error: error.message,
                stack: error.stack
            });
            
            console.log(`  ❌ FAILED: ${testName} - ${error.message}`);
        }
    }
    
    generateTestReport() {
        console.log('\n📊 TEST REPORT');
        console.log('=' .repeat(50));
        console.log(`Total Tests: ${this.testResults.total}`);
        console.log(`Passed: ${this.testResults.passed}`);
        console.log(`Failed: ${this.testResults.failed}`);
        console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);
        
        if (this.testResults.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults.details
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`  - ${test.name}: ${test.error}`);
                });
        }
        
        console.log('\n✅ PASSED TESTS:');
        this.testResults.details
            .filter(test => test.status === 'PASSED')
            .forEach(test => {
                console.log(`  - ${test.name} (${test.duration}ms)`);
            });
        
        const overallStatus = this.testResults.failed === 0 ? 'SUCCESS' : 'PARTIAL SUCCESS';
        console.log(`\n🎯 OVERALL STATUS: ${overallStatus}`);
        console.log('=' .repeat(50));
        
        return {
            status: overallStatus,
            total: this.testResults.total,
            passed: this.testResults.passed,
            failed: this.testResults.failed,
            successRate: (this.testResults.passed / this.testResults.total) * 100,
            details: this.testResults.details
        };
    }
    
    async cleanup() {
        try {
            console.log('\n🧹 Cleaning up test environment...');
            
            // Clean up test data from database
            await this.integrationLayer.pool.query(
                "DELETE FROM code_sessions WHERE user_id LIKE 'test-%' OR user_id LIKE 'perf-%' OR user_id LIKE 'concurrent-%' OR user_id LIKE 'error-%'"
            );
            
            // Shutdown systems
            if (this.integrationLayer) {
                await this.integrationLayer.shutdown();
            }
            
            if (this.analysisSystem) {
                await this.analysisSystem.shutdown();
            }
            
            console.log('✅ Cleanup completed');
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }
}

// Main execution function
async function runOrchestrationTests() {
    const tester = new OrchestrationSystemTester();
    
    try {
        await tester.initialize();
        const report = await tester.runAllTests();
        
        return report;
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        throw error;
    } finally {
        await tester.cleanup();
    }
}

// Export for use in other modules
module.exports = {
    OrchestrationSystemTester,
    runOrchestrationTests
};

// Run tests if this file is executed directly
if (require.main === module) {
    runOrchestrationTests()
        .then(report => {
            console.log('\n🎉 Test suite completed!');
            process.exit(report.failed === 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}