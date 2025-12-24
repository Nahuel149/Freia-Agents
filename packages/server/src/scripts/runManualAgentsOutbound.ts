import { runOutbound } from '../manual-agents/outbound'

const run = async () => {
    const result = await runOutbound({ source: 'cli' })
    // eslint-disable-next-line no-console
    console.log('[manual-agents] outbound summary', JSON.stringify(result, null, 2))
}

run().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[manual-agents] outbound error', error)
    process.exit(1)
})
