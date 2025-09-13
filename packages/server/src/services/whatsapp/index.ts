import axios from 'axios'
import logger from '../../utils/logger'
import { DataSource } from 'typeorm'
import { CodeLanguage, executeCode } from '../../utils/codeExecution'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { CodeAgent } from '../../database/entities/CodeAgent'

export interface SendMessagePayload {
    to: string
    text: string
}

export class WhatsAppService {
    private apiKey: string
    private baseUrl: string

    constructor() {
        this.apiKey = process.env.WASENDER_API_KEY || ''
        this.baseUrl = (process.env.WASENDER_API_URL || 'https://wasenderapi.com/api').replace(/\/$/, '')
    }

    async sendMessage(payload: SendMessagePayload) {
        if (!this.apiKey) throw new Error('WASENDER_API_KEY not set')
        const url = `${this.baseUrl}/send-message`
        const res = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        })
        return res.data
    }

    /**
     * Executes a CodeAgent and returns its output text (supports JSON output with reply)
     */
    async executeCodeAgentAndGetReply(codeAgentId: string, input: string, chatHistory: any[] = []) {
        const app = getRunningExpressApp()
        const ds: DataSource = app.AppDataSource
        const repo = ds.getRepository(CodeAgent)
        const agent = await repo.findOne({ where: { id: codeAgentId } })
        if (!agent) throw new Error('CodeAgent not found')

        const env = {
            ...(process.env || {}),
            FLOWISE_INPUT: input,
            FLOWISE_CHAT_HISTORY: JSON.stringify(chatHistory || [])
        }

        let lang: CodeLanguage
        switch ((agent.language || '').toLowerCase()) {
            case 'python': lang = CodeLanguage.PYTHON; break
            case 'typescript': lang = CodeLanguage.TYPESCRIPT; break
            default: lang = CodeLanguage.JAVASCRIPT
        }

        const result = await executeCode(agent.code, lang, { environmentVariables: env, timeout: 60000 })
        if (!result.success) throw new Error(result.error || 'Execution failed')

        // Try JSON output { reply, events, followUp }
        try {
            const parsed = JSON.parse(result.output || '{}')
            if (parsed && parsed.reply) return { text: String(parsed.reply), raw: parsed }
        } catch {}
        return { text: (result.output || '').toString(), raw: null }
    }
}

