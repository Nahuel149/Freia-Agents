import client from './client'

// Enhanced CodeAgent API with orchestration capabilities
const codeAgentOrchestrationApi = {
    // Original CodeAgent endpoints
    getAllCodeAgents: () => client.get('/code-agents'),
    getSpecificCodeAgent: (id) => client.get(`/code-agents/${id}`),
    createCodeAgent: (body) => client.post('/code-agents', body),
    updateCodeAgent: (id, body) => client.put(`/code-agents/${id}`, body),
    deleteCodeAgent: (id) => client.delete(`/code-agents/${id}`),
    executeCodeAgent: (id, body) => client.post(`/code-agents/${id}/execute`, body),
    getCodeAgentExecution: (id, executionId) => client.get(`/code-agents/${id}/executions/${executionId}`),
    getCodeAgentExecutions: (id) => client.get(`/code-agents/${id}/executions`),

    // New orchestration endpoints
    generateCodeWithOrchestration: (body) => client.post('/code-orchestration/generate', body),
    
    // Session management
    createSession: (body) => client.post('/code-orchestration/sessions', body),
    getSession: (sessionId) => client.get(`/code-orchestration/sessions/${sessionId}`),
    updateSession: (sessionId, body) => client.put(`/code-orchestration/sessions/${sessionId}`, body),
    deleteSession: (sessionId) => client.delete(`/code-orchestration/sessions/${sessionId}`),
    getUserSessions: (userId) => client.get(`/code-orchestration/sessions/user/${userId}`),
    
    // Task management
    getSessionTasks: (sessionId) => client.get(`/code-orchestration/sessions/${sessionId}/tasks`),
    getTask: (taskId) => client.get(`/code-orchestration/tasks/${taskId}`),
    updateTask: (taskId, body) => client.put(`/code-orchestration/tasks/${taskId}`, body),
    
    // Follow-up system
    getSessionFollowUps: (sessionId) => client.get(`/code-orchestration/sessions/${sessionId}/followups`),
    scheduleFollowUp: (body) => client.post('/code-orchestration/followups', body),
    executeFollowUp: (followUpId) => client.post(`/code-orchestration/followups/${followUpId}/execute`),
    updateFollowUp: (followUpId, body) => client.put(`/code-orchestration/followups/${followUpId}`, body),
    
    // Analytics and metrics
    getSessionAnalytics: (sessionId) => client.get(`/code-orchestration/sessions/${sessionId}/analytics`),
    getUserAnalytics: (userId) => client.get(`/code-orchestration/analytics/user/${userId}`),
    getSystemMetrics: () => client.get('/code-orchestration/metrics'),
    
    // Agent workflows
    getAvailableAgents: () => client.get('/code-orchestration/agents'),
    getAgentConfig: (agentType) => client.get(`/code-orchestration/agents/${agentType}/config`),
    getWorkflows: () => client.get('/code-orchestration/workflows'),
    executeWorkflow: (workflowId, body) => client.post(`/code-orchestration/workflows/${workflowId}/execute`, body),
    
    // Code analysis
    analyzeCode: (body) => client.post('/code-orchestration/analyze', body),
    getAnalysisResults: (sessionId) => client.get(`/code-orchestration/sessions/${sessionId}/analysis`),
    
    // Health and status
    getSystemHealth: () => client.get('/code-orchestration/health'),
    getSystemStatus: () => client.get('/code-orchestration/status')
}

export default codeAgentOrchestrationApi