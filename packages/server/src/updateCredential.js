const { Client } = require('pg')

async function updateCredential() {
    const client = new Client({
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432', 10),
        user: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME || 'flowise'
    })

    if (!process.env.DATABASE_PASSWORD) {
        console.error('Error: DATABASE_PASSWORD environment variable is required')
        process.exit(1)
    }

    try {
        await client.connect()
        const query =
            "UPDATE \"user\" SET credential = '$2a$05$O0klnLMTfLJCbBr3wChG4OwBQvOaGizUyE1AmQJRlfNlAjZ1rL1E2' WHERE email = 'admin@freia.ai'"
        const res = await client.query(query)
        console.log('Update successful:', res.rowCount, 'row(s) updated')
    } catch (err) {
        console.error('Error updating credential:', err)
    } finally {
        await client.end()
    }
}

updateCredential()
