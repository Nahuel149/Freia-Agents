import client from './client'

export default {
    // Direct CodeAgent CRUD & execution
    getAllCodeAgents: () => client.get('/codeagent'),
    getSpecificCodeAgent: (id) => client.get(`/codeagent/${id}`),
    createCodeAgent: (body) => client.post('/codeagent', body),
    updateCodeAgent: (id, body) => client.put(`/codeagent/${id}`, body),
    deleteCodeAgent: (id) => client.delete(`/codeagent/${id}`),
    executeCodeAgent: (id, body) => client.post(`/codeagent/execute/${id}`, body),
    getCodeAgentExecution: (id, executionId) => client.get(`/codeagent/executions/${id}`),
    getCodeAgentExecutions: (id) => client.get(`/codeagent/executions/${id}`),

    // Orchestration endpoints (prefixed by client baseURL '/api/v1')
    generateCodeWithOrchestration: (body) => client.post('/codeagent-orchestration/generate', body),

    // Sessions
    createSession: (body) => client.post('/codeagent-orchestration/sessions', body),
    getSession: (sessionId) => client.get(`/codeagent-orchestration/sessions/${sessionId}`),
    updateSession: (sessionId, body) => client.put(`/codeagent-orchestration/sessions/${sessionId}`, body),
    deleteSession: (sessionId) => client.delete(`/codeagent-orchestration/sessions/${sessionId}`),
    getUserSessions: (userId) => client.get(`/codeagent-orchestration/sessions/user/${userId}`),

    // Tasks
    getSessionTasks: (sessionId) => client.get(`/codeagent-orchestration/sessions/${sessionId}/tasks`),
    getTask: (taskId) => client.get(`/codeagent-orchestration/tasks/${taskId}`),
    updateTask: (taskId, body) => client.put(`/codeagent-orchestration/tasks/${taskId}`, body),

    // Follow-ups
    getSessionFollowUps: (sessionId) => client.get(`/codeagent-orchestration/sessions/${sessionId}/followups`),
    scheduleFollowUp: (body) => client.post('/codeagent-orchestration/followups', body),
    executeFollowUp: (followUpId) => client.post(`/codeagent-orchestration/followups/${followUpId}/execute`),
    updateFollowUp: (followUpId, body) => client.put(`/codeagent-orchestration/followups/${followUpId}`, body),

    // Analytics
    getSessionAnalytics: (sessionId) => client.get(`/codeagent-orchestration/sessions/${sessionId}/analytics`),
    getUserAnalytics: (userId) => client.get(`/codeagent-orchestration/analytics/user/${userId}`),

    // System metrics & health
    getSystemMetrics: () => client.get('/codeagent-orchestration/metrics'),
    getSystemHealth: () => client.get('/codeagent-orchestration/health'),
    getSystemStatus: () => client.get('/codeagent-orchestration/status'),

    // Agents & workflows
    getAvailableAgents: () => client.get('/codeagent-orchestration/agents'),
    getAgentConfig: (agentType) => client.get(`/codeagent-orchestration/agents/${agentType}/config`),
    getWorkflows: () => client.get('/codeagent-orchestration/workflows'),
    executeWorkflow: (workflowId, body) => client.post(`/codeagent-orchestration/workflows/${workflowId}/execute`, body),

    // Code analysis
    analyzeCode: (body) => client.post('/codeagent-orchestration/analyze', body),
    getAnalysisResults: (sessionId) => client.get(`/codeagent-orchestration/sessions/${sessionId}/analysis`)
}
