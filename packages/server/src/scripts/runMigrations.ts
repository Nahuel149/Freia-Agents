import { dataSource } from '../utils/typeormDataSource'

async function main() {
    await dataSource.initialize()
    const results = await dataSource.runMigrations()
    for (const r of results) {
        console.log(`[migration] ${r.name}`)
    }
    await dataSource.destroy()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
