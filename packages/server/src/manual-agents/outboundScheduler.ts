import moment from 'moment-timezone'
import { runOutbound } from './outbound'

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires'
const DEFAULT_HOUR = 9
const DEFAULT_MINUTE = 0

const parseNumber = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value || '', 10)
    return Number.isNaN(parsed) ? fallback : parsed
}

const computeNextRun = (timezone: string, hour: number, minute: number) => {
    const now = moment.tz(timezone)
    let nextRun = now.clone().hour(hour).minute(minute).second(0).millisecond(0)
    if (nextRun.isSameOrBefore(now)) {
        nextRun = nextRun.add(1, 'day')
    }
    return nextRun
}

export const startManualAgentsOutboundScheduler = () => {
    const enabled = (process.env.MANUAL_AGENT_OUTBOUND_SCHEDULE_ENABLED || '').toLowerCase() === 'true'
    if (!enabled) return

    const timezone = process.env.MANUAL_AGENT_OUTBOUND_TIMEZONE || DEFAULT_TIMEZONE
    const hour = parseNumber(process.env.MANUAL_AGENT_OUTBOUND_HOUR, DEFAULT_HOUR)
    const minute = parseNumber(process.env.MANUAL_AGENT_OUTBOUND_MINUTE, DEFAULT_MINUTE)
    const agentId = process.env.MANUAL_AGENT_OUTBOUND_AGENT_ID || 'quintas'

    const scheduleNext = () => {
        const nextRun = computeNextRun(timezone, hour, minute)
        const delayMs = Math.max(nextRun.diff(moment.tz(timezone)), 1000)

        setTimeout(async () => {
            try {
                await runOutbound({ agentId, source: 'schedule' })
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error'
                console.error('[manual-agents] outbound schedule error', message)
            } finally {
                scheduleNext()
            }
        }, delayMs)
    }

    scheduleNext()
}
