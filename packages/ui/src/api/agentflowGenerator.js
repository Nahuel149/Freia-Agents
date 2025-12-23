import client from './client'

const getAllAgentflowv2Marketplaces = () => client.get('/agentflowv2-generator/marketplaces')

const generateAgentflow = (body) => client.post('/agentflowv2-generator/generate', body)

export default {
    getAllAgentflowv2Marketplaces,
    generateAgentflow
}
