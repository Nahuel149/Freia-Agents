export type ManualAgentStatus = 'draft' | 'active' | 'archived'

export type ManualAgentRequest = {
    message: string
    sessionId: string
    locale?: string
    metadata?: Record<string, unknown>
}

export type ManualAgentResponse = {
    answer: string
    metadata?: Record<string, unknown>
}

export type ManualAgentToolDefinition = {
    name: string
    description: string
    parameters: Record<string, unknown>
}

export type ManualAgentDefinition = {
    id: string
    name: string
    description: string
    status: ManualAgentStatus
    version: string
    llmModel?: string
    tools?: ManualAgentToolDefinition[]
    allowedCollections: string[]
    allowedOps: Array<'read' | 'write'>
    handler: (input: ManualAgentRequest) => Promise<ManualAgentResponse>
}
