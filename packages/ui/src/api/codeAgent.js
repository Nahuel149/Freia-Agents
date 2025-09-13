import client from './client'

const getAllCodeAgents = () => client.get('/codeagent')
const getSpecificCodeAgent = (id) => client.get(`/codeagent/${id}`)
const createCodeAgent = (body) => client.post('/codeagent', body)
const updateCodeAgent = (id, body) => client.put(`/codeagent/${id}`, body)
const deleteCodeAgent = (id) => client.delete(`/codeagent/${id}`)
const executeCodeAgent = (id, body) => client.post(`/codeagent/execute/${id}`, body)
const getCodeAgentExecution = (id, executionId) => client.get(`/codeagent/executions/${id}`)
const getCodeAgentExecutions = (id) => client.get(`/codeagent/executions/${id}`)

// Orchestration endpoints (client baseURL already includes '/api/v1')
const getSystemHealth = () => client.get('/codeagent-orchestration/health')
const processCodeRequest = (body) => client.post('/codeagent-orchestration/process', body)
const scheduleFollowUp = (body) => client.post('/codeagent-orchestration/follow-up', body)
const getAgentDefinitions = () => client.get('/codeagent-orchestration/agent-definitions')
const executeWorkflow = (body) => client.post('/codeagent-orchestration/execute-workflow', body)
const getDocumentStores = () => client.get('/codeagent-orchestration/document-stores')
const getDocumentLoaders = (documentStoreId) => client.get(`/codeagent-orchestration/document-stores/${documentStoreId}/loaders`)
const processWithDocuments = (body) => client.post('/codeagent-orchestration/process-with-documents', body)

export default {
    getAllCodeAgents,
    getSpecificCodeAgent,
    createCodeAgent,
    updateCodeAgent,
    deleteCodeAgent,
    executeCodeAgent,
    getCodeAgentExecution,
    getCodeAgentExecutions,
    getSystemHealth,
    processCodeRequest,
    scheduleFollowUp,
    getAgentDefinitions,
    executeWorkflow,
    getDocumentStores,
    getDocumentLoaders,
    processWithDocuments
}