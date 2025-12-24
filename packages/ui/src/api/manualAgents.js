import client from './client'

const getAllManualAgents = (params) => client.get('/manual-agents', { params })
const getManualAgent = (id) => client.get(`/manual-agents/${id}`)
const getManualAgentSessions = (id, params) => client.get(`/manual-agents/${id}/sessions`, { params })
const getManualAgentSession = (id, sessionId) => client.get(`/manual-agents/${id}/sessions/${sessionId}`)
const chatManualAgent = (id, body) => client.post(`/manual-agents/${id}/chat`, body)
const createHold = (id, body) => client.post(`/manual-agents/${id}/holds`, body)
const confirmPayment = (id, body) => client.post(`/manual-agents/${id}/payments/confirm`, body)
const createShareToken = (id, body) => client.post(`/manual-agents/${id}/share`, body)
const revokeShareToken = (id, tokenId) => client.delete(`/manual-agents/${id}/share/${tokenId}`)
const publicChat = (token, body) => client.post(`/manual-agents/public/${token}/chat`, body)
const getPublicSession = (token, sessionId) => client.get(`/manual-agents/public/${token}/session/${sessionId}`)
const getPublicAgentInfo = (token) => client.get(`/manual-agents/public/${token}`)
const getKpi = (id, params) => client.get(`/manual-agents/${id}/kpi`, { params })
const getOutbound = (id) => client.get(`/manual-agents/${id}/outbound`)
const sendOutbound = (id, body) => client.post(`/manual-agents/${id}/outbound/send`, body)
const seedManualAgentData = (id) => client.post(`/manual-agents/${id}/seed`)
const getShareTokens = (id) => client.get(`/manual-agents/${id}/share`)
const archiveManualAgent = (id) => client.delete(`/manual-agents/${id}`)

export default {
    getAllManualAgents,
    getManualAgent,
    getManualAgentSessions,
    getManualAgentSession,
    chatManualAgent,
    createHold,
    confirmPayment,
    createShareToken,
    revokeShareToken,
    publicChat,
    getPublicSession,
    getPublicAgentInfo,
    getKpi,
    getOutbound,
    sendOutbound,
    seedManualAgentData,
    getShareTokens,
    archiveManualAgent
}
