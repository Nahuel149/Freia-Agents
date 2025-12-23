import { Client } from 'pg'
import fs from 'fs'
import path from 'path'

type Table = { schema: string; name: string; type: string }
type Column = {
    table_schema: string
    table_name: string
    column_name: string
    data_type: string
    is_nullable: string
    column_default: string | null
    character_maximum_length: number | null
    numeric_precision: number | null
    numeric_scale: number | null
}

type PrimaryKey = { table_schema: string; table_name: string; column_name: string; constraint_name: string }
type ForeignKey = {
    table_schema: string
    table_name: string
    column_name: string
    foreign_table_schema: string
    foreign_table_name: string
    foreign_column_name: string
    constraint_name: string
}
type Index = { schemaname: string; tablename: string; indexname: string; indexdef: string }

async function main() {
    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURL
    if (!connStr) {
        console.error('Missing DATABASE_URL (or POSTGRES_URL/PGURL). Set it to your Postgres connection string.')
        process.exit(1)
    }

    const client = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()

    const schemaFilter = process.env.DB_SCHEMA // optional, comma-separated
    const schemaWhere = schemaFilter
        ? `AND t.table_schema = ANY(string_to_array($1, ',')::text[])`
        : `AND t.table_schema NOT IN ('pg_catalog','information_schema')`

    const params: any[] = []
    if (schemaFilter) params.push(schemaFilter)

    const tablesRes = await client.query<Table>(
        `SELECT t.table_schema as schema, t.table_name as name, t.table_type as type
         FROM information_schema.tables t
         WHERE 1=1 ${schemaWhere}
         ORDER BY t.table_schema, t.table_name`,
        params
    )

    const columnsRes = await client.query<Column>(
        `SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default,
                character_maximum_length, numeric_precision, numeric_scale
         FROM information_schema.columns c
         WHERE 1=1 ${
             schemaFilter
                 ? `AND c.table_schema = ANY(string_to_array($1, ',')::text[])`
                 : `AND c.table_schema NOT IN ('pg_catalog','information_schema')`
         }
         ORDER BY table_schema, table_name, ordinal_position`,
        params
    )

    const pkRes = await client.query<PrimaryKey>(
        `SELECT tc.table_schema, tc.table_name, kcu.column_name, tc.constraint_name
         FROM information_schema.table_constraints AS tc
         JOIN information_schema.key_column_usage AS kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           ${
               schemaFilter
                   ? `AND tc.table_schema = ANY(string_to_array($1, ',')::text[])`
                   : `AND tc.table_schema NOT IN ('pg_catalog','information_schema')`
           }
         ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position`,
        params
    )

    const fkRes = await client.query<ForeignKey>(
        `SELECT
            tc.table_schema,
            tc.table_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            tc.constraint_name
         FROM information_schema.table_constraints AS tc
         JOIN information_schema.key_column_usage AS kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage AS ccu
           ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           ${
               schemaFilter
                   ? `AND tc.table_schema = ANY(string_to_array($1, ',')::text[])`
                   : `AND tc.table_schema NOT IN ('pg_catalog','information_schema')`
           }
         ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position`,
        params
    )

    const idxRes = await client.query<Index>(
        `SELECT schemaname, tablename, indexname, indexdef
         FROM pg_indexes
         WHERE 1=1 ${
             schemaFilter
                 ? `AND schemaname = ANY(string_to_array($1, ',')::text[])`
                 : `AND schemaname NOT IN ('pg_catalog','information_schema')`
         }
         ORDER BY schemaname, tablename, indexname`,
        params
    )

    await client.end()

    const columnsByTable = new Map<string, Column[]>()
    columnsRes.rows.forEach((c) => {
        const key = `${c.table_schema}.${c.table_name}`
        const arr = columnsByTable.get(key) || []
        arr.push(c)
        columnsByTable.set(key, arr)
    })

    const pkByTable = new Map<string, PrimaryKey[]>()
    pkRes.rows.forEach((p) => {
        const key = `${p.table_schema}.${p.table_name}`
        const arr = pkByTable.get(key) || []
        arr.push(p)
        pkByTable.set(key, arr)
    })

    const fkByTable = new Map<string, ForeignKey[]>()
    fkRes.rows.forEach((f) => {
        const key = `${f.table_schema}.${f.table_name}`
        const arr = fkByTable.get(key) || []
        arr.push(f)
        fkByTable.set(key, arr)
    })

    const idxByTable = new Map<string, Index[]>()
    idxRes.rows.forEach((i) => {
        const key = `${i.schemaname}.${i.tablename}`
        const arr = idxByTable.get(key) || []
        arr.push(i)
        idxByTable.set(key, arr)
    })

    let md = ''
    md += `# Database Schema\n\n`
    md += `Generated on ${new Date().toISOString()}\n\n`
    if (schemaFilter) md += `Schemas: ${schemaFilter}\n\n`

    // Overview table
    md += `## Tables\n\n`
    md += `- Total: ${tablesRes.rows.length}\n\n`

    for (const t of tablesRes.rows) {
        const key = `${t.schema}.${t.name}`
        md += `### ${t.schema}.${t.name}\n\n`
        md += `- Type: ${t.type}\n`
        const pks = pkByTable.get(key) || []
        if (pks.length) md += `- Primary Key: ${[...new Set(pks.map((p) => p.column_name))].join(', ')}\n`

        const cols = columnsByTable.get(key) || []
        if (cols.length) {
            md += `\n#### Columns\n`
            md += `| Column | Type | Nullable | Default | Notes |\n|---|---|---|---|---|\n`
            for (const c of cols) {
                const typParts: string[] = [c.data_type]
                if (c.character_maximum_length) typParts.push(`(${c.character_maximum_length})`)
                if (c.numeric_precision !== null)
                    typParts.push(`(${c.numeric_precision}${c.numeric_scale !== null ? ',' + c.numeric_scale : ''})`)
                const nullable = c.is_nullable === 'YES' ? 'YES' : 'NO'
                const def = c.column_default ? '`' + c.column_default + '`' : ''
                md += `| ${c.column_name} | ${typParts.join('')} | ${nullable} | ${def} | |\n`
            }
            md += `\n`
        }

        const fks = fkByTable.get(key) || []
        if (fks.length) {
            md += `#### Foreign Keys\n`
            for (const f of fks) {
                md +=
                    `- ${f.column_name} → ${f.foreign_table_schema}.${f.foreign_table_name}(${f.foreign_column_name})` +
                    ` \`[${f.constraint_name}]\`` +
                    `\n`
            }
            md += `\n`
        }

        const idxs = idxByTable.get(key) || []
        if (idxs.length) {
            md += `#### Indexes\n`
            for (const i of idxs) {
                md += `- ${i.indexname}: \`${i.indexdef}\`\n`
            }
            md += `\n`
        }
    }

    const outDir = path.resolve(process.cwd(), 'docs')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const outFile = path.join(outDir, 'DB_SCHEMA.md')
    fs.writeFileSync(outFile, md, 'utf-8')
    // eslint-disable-next-line no-console
    console.log(`Schema documentation written to ${outFile}`)
}

main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exit(1)
})
