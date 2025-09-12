import client from './client'

const getAllCodeAgents = () => client.get('/code-agents')

const getSpecificCodeAgent = (id) => client.get(`/code-agents/${id}`)

const createCodeAgent = (body) => client.post('/code-agents', body)

const updateCodeAgent = (id, body) => client.put(`/code-agents/${id}`, body)

const deleteCodeAgent = (id) => client.delete(`/code-agents/${id}`)

const executeCodeAgent = (id, body) => client.post(`/code-agents/${id}/execute`, body)

const getCodeAgentExecution = (id, executionId) => client.get(`/code-agents/${id}/executions/${executionId}`)

const getCodeAgentExecutions = (id) => client.get(`/code-agents/${id}/executions`)

// CodeAgent Orchestration API
const getSystemHealth = () => client.get('/api/v1/codeagent-orchestration/health')

const processCodeRequest = (body) => client.post('/api/v1/codeagent-orchestration/process', body)

const scheduleFollowUp = (body) => client.post('/api/v1/codeagent-orchestration/follow-up', body)

const getAgentDefinitions = () => client.get('/api/v1/codeagent-orchestration/agent-definitions')

const executeWorkflow = (body) => client.post('/api/v1/codeagent-orchestration/execute-workflow', body)

// Document Store Integration API
const getDocumentStores = () => client.get('/api/v1/codeagent-orchestration/document-stores')

const getDocumentLoaders = (documentStoreId) => client.get(`/api/v1/codeagent-orchestration/document-stores/${documentStoreId}/loaders`)

const processWithDocuments = (body) => client.post('/api/v1/codeagent-orchestration/process-with-documents', body)

export default {
    getAllCodeAgents,
    getSpecificCodeAgent,
    createCodeAgent,
    updateCodeAgent,
    deleteCodeAgent,
    executeCodeAgent,
    getCodeAgentExecution,
    getCodeAgentExecutions,
    // Orchestration methods
    getSystemHealth,
    processCodeRequest,
    scheduleFollowUp,
    getAgentDefinitions,
    executeWorkflow,
    // Document integration methods
    getDocumentStores,
    getDocumentLoaders,
    processWithDocuments
}