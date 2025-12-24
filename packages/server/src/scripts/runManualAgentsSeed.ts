import 'dotenv/config'
import { importHotelSeed } from '../manual-agents/hotelData'
import { importQuintasSeed } from '../manual-agents/quintasData'

const run = async () => {
    const quintas = await importQuintasSeed()
    const hotel = await importHotelSeed()
    // eslint-disable-next-line no-console
    console.log('[manual-agents] seed summary', JSON.stringify({ quintas, hotel }, null, 2))
}

run().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[manual-agents] seed error', error)
    process.exit(1)
})
