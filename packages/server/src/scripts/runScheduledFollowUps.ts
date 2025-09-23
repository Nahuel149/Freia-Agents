import 'dotenv/config'
import axios from 'axios'
import { init as initDataSource, getDataSource } from '../DataSource'
import logger from '../utils/logger'
import { FollowUp } from '../database/entities/FollowUp'

const DEFAULT_BATCH_SIZE = 20
const DEFAULT_RETRY_MINUTES = 60
const DEFAULT_TIMEOUT_MS = 30000

const flowiseBaseUrl = (process.env.FLOWISE_BASE_URL || process.env.FLOWISE_RUNTIME_URL || '').trim()
const freiaApiKey = (process.env.FREIA_API_KEY || process.env.FLOWISE_API_KEY || '').trim()
const followUpChatflowId = (process.env.FOLLOW_UP_CHATFLOW_ID || '').trim()
const batchSize = Number.parseInt(process.env.FOLLOW_UP_BATCH_SIZE || '', 10) || DEFAULT_BATCH_SIZE
const retryDelayMinutes = Number.parseInt(process.env.FOLLOW_UP_RETRY_MINUTES || '', 10) || DEFAULT_RETRY_MINUTES
const requestTimeoutMs = Number.parseInt(process.env.FOLLOW_UP_REQUEST_TIMEOUT_MS || '', 10) || DEFAULT_TIMEOUT_MS
const overrideEnabled = (process.env.FOLLOW_UP_OVERRIDE_ENABLED || '').toLowerCase() === 'true'

if (!flowiseBaseUrl) {
    logger.error('[followups] FLOWISE_BASE_URL (or FLOWISE_RUNTIME_URL) is required')
    process.exit(1)
}

if (!followUpChatflowId) {
    logger.error('[followups] FOLLOW_UP_CHATFLOW_ID is required')
    process.exit(1)
}

const flowiseUrl = `${flowiseBaseUrl.replace(/\/$/, '')}/api/v1/prediction/${followUpChatflowId}`

const truncate = (value: string | null | undefined, limit = 2000) => {
    if (!value) return null
    return value.length > limit ? `${value.slice(0, limit)}…` : value
}

const nextRetryDate = () => new Date(Date.now() + retryDelayMinutes * 60 * 1000)

async function triggerFollowUp(followUp: FollowUp) {
    const attemptLabel = `#${followUp.attemptNumber}`
    const details = {
        id: followUp.id,
        customerId: followUp.customerId,
        phoneNumber: followUp.phoneNumber,
        saleId: followUp.saleId,
        followUpType: followUp.followUpType,
        attemptNumber: followUp.attemptNumber,
        maxAttempts: followUp.maxAttempts,
        nextAction: followUp.nextAction
    }

    const sessionKey = (() => {
        if (followUp.customerId) return `customer-${followUp.customerId}`
        if (followUp.phoneNumber) {
            const normalized = followUp.phoneNumber.replace(/[^+\\d]/g, '')
            return `phone-${normalized}`
        }
        return `followup-${followUp.id}`
    })()

    const payload: Record<string, unknown> = {
        question: `Ejecutá el seguimiento programado (${followUp.followUpType}) para el cliente ${followUp.phoneNumber}. Intento ${attemptLabel}. Datos: ${JSON.stringify(details)}`,
        chatId: sessionKey,
        metadata: {
            source: 'cron_follow_up_runner',
            followUpId: followUp.id,
            attempt: followUp.attemptNumber
        }
    }

    if (overrideEnabled) {
        payload.overrideConfig = {
            sessionId: sessionKey,
            vars: {
                followUpId: followUp.id,
                customerId: followUp.customerId,
                phoneNumber: followUp.phoneNumber,
                saleId: followUp.saleId,
                followUpType: followUp.followUpType,
                attemptNumber: followUp.attemptNumber,
                maxAttempts: followUp.maxAttempts
            }
        }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'flowise-tool': 'true' }
    if (freiaApiKey) {
        headers.Authorization = `Bearer ${freiaApiKey}`
    }

    const response = await axios.post(flowiseUrl, payload, {
        headers,
        timeout: requestTimeoutMs,
        validateStatus: () => true
    })

    if (response.status < 200 || response.status >= 300) {
        const message = `Flowise request failed with status ${response.status}`
        throw new Error(`${message}: ${typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}`)
    }

    const data = response.data
    if (data && typeof data === 'object') {
        const text = typeof data.text === 'string' ? data.text : null
        const output = typeof data.response === 'string' ? data.response : null
        const combined = text || output || JSON.stringify(data)
        return truncate(combined)
    }

    if (typeof data === 'string') {
        return truncate(data)
    }

    return null
}

async function main() {
    logger.info('[followups] Starting scheduled follow-up runner')

    await initDataSource()
    const dataSource = getDataSource()
    if (!dataSource.isInitialized) {
        await dataSource.initialize()
    }

    try {
        const repository = dataSource.getRepository(FollowUp)

        const dueFollowUps = await repository
            .createQueryBuilder('follow_up')
            .where('follow_up.status = :status', { status: 'pending' })
            .andWhere('follow_up.scheduled_at <= NOW()')
            .orderBy('follow_up.scheduled_at', 'ASC')
            .limit(batchSize)
            .getMany()

        if (!dueFollowUps.length) {
            logger.info('[followups] No pending follow-ups to process')
            return
        }

        logger.info(`[followups] Processing ${dueFollowUps.length} follow-up(s)`)    

        let successCount = 0
        let failureCount = 0

        for (const followUp of dueFollowUps) {
            const started = Date.now()
            try {
                const updateResult = await repository.update({ id: followUp.id, status: 'pending' }, { status: 'in_progress', updatedAt: new Date() })
                if (!updateResult.affected) {
                    logger.info(`[followups] Skipping follow-up ${followUp.id} (already picked by another worker)`) 
                    continue
                }

                const messageSent = await triggerFollowUp(followUp)
                await repository.update(followUp.id, {
                    status: 'completed',
                    messageSent,
                    attemptNumber: followUp.attemptNumber + 1,
                    completedAt: new Date(),
                    updatedAt: new Date()
                })

                successCount += 1
                logger.info(
                    `[followups] Follow-up ${followUp.id} completed in ${(Date.now() - started).toLocaleString()} ms` +
                        (messageSent ? ` | response: ${messageSent.replace(/\s+/g, ' ').slice(0, 120)}` : '')
                )
            } catch (error) {
                failureCount += 1
                const nextAttempt = followUp.attemptNumber + 1
                const errorMessage = truncate((error as Error).message, 1000)
                const update: Partial<FollowUp> = {
                    attemptNumber: nextAttempt,
                    messageSent: errorMessage,
                    status: nextAttempt >= followUp.maxAttempts ? 'failed' : 'pending',
                    updatedAt: new Date()
                }

                if (nextAttempt >= followUp.maxAttempts) {
                    update.completedAt = new Date()
                } else {
                    update.scheduledAt = nextRetryDate()
                }

                await repository.update(followUp.id, update)
                logger.error(`[followups] Follow-up ${followUp.id} failed: ${(error as Error).message}`)
            }
        }

        logger.info(`[followups] Finished run | success: ${successCount} | failure: ${failureCount}`)
    } finally {
        const dataSource = getDataSource()
        if (dataSource.isInitialized) {
            await dataSource.destroy()
        }
    }
}

if (require.main === module) {
    main()
        .then(() => {
            logger.info('[followups] Runner completed successfully')
            process.exit(0)
        })
        .catch((error) => {
            logger.error('[followups] Runner failed', error)
            process.exit(1)
        })
}
