const DEFAULT_MANUAL_AGENT_LLM_MODEL = 'gpt-4.1-mini'

export const getManualAgentModel = () => {
    return process.env.MANUAL_AGENT_LLM_MODEL || DEFAULT_MANUAL_AGENT_LLM_MODEL
}

export const getManualAgentOpenAIKey = () => {
    return process.env.MANUAL_AGENT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''
}
