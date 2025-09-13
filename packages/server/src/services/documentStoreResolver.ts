import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

type StoreKind = 'products' | 'clients' | 'orders' | 'manual' | 'generic'

export interface StoreEnvelopeStore {
    id: string
    name: string
    kind: StoreKind
    data: any
    meta?: { bytes?: number; source?: string; updatedAt?: string }
}

export interface StoreEnvelope {
    version: '1'
    stores: StoreEnvelopeStore[]
}

export interface ResolveResult {
    envelope: StoreEnvelope
    totalBytes: number
    datasetHash: string
    statuses: Record<string, 'ok' | 'error'>
}

const ID_TO_FILE_AND_KIND: Record<string, { filename: string; kind: StoreKind; name: string }> = {
    productosgomerias: { filename: 'productosgomerias.json', kind: 'products', name: 'Productos' },
    clientesgomeria: { filename: 'clientesgomeria.json', kind: 'clients', name: 'Clientes' },
    ventasgomeria: { filename: 'ventasgomeria.json', kind: 'orders', name: 'Ventas' },
    manualgomeria: { filename: 'manualgomeria.json', kind: 'manual', name: 'Manual' }
}

const SOFT_CAP_BYTES = 100 * 1024 * 1024 // 100MB

function findRepoRoot(startDir: string, targetFilenames: string[]): string | null {
    // Walk upwards until we find monorepo root (pnpm-workspace.yaml) or a directory containing the target files
    let dir = startDir
    for (let i = 0; i < 12; i++) {
        const hasWorkspace = fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))
        if (hasWorkspace) return dir
        const anyTargetHere = targetFilenames.some((fname) => fs.existsSync(path.join(dir, fname)))
        if (anyTargetHere) return dir
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return null
}

function normalizeData(kind: StoreKind, raw: any) {
    if (kind === 'products') {
        if (Array.isArray(raw)) return { products: raw }
        if (raw && Array.isArray(raw.products)) return { products: raw.products }
        if (raw && Array.isArray(raw.productos)) return { products: raw.productos }
        return { products: [] }
    }
    if (kind === 'clients') {
        if (Array.isArray(raw)) return { clients: raw }
        if (raw && Array.isArray(raw.clients)) return { clients: raw.clients }
        if (raw && Array.isArray(raw.clientes)) return { clients: raw.clientes }
        return { clients: [] }
    }
    if (kind === 'orders') {
        if (Array.isArray(raw)) return { orders: raw }
        if (raw && Array.isArray(raw.orders)) return { orders: raw.orders }
        if (raw && Array.isArray(raw.ventas)) return { orders: raw.ventas }
        if (raw && Array.isArray(raw.sales)) return { orders: raw.sales }
        return { orders: [] }
    }
    if (kind === 'manual') {
        if (raw == null) return { content: '' }
        if (typeof raw === 'string') return { content: raw }
        if (Array.isArray(raw)) return { content: raw }
        if (raw && (raw.content || raw.sections)) return { content: raw.content || raw.sections }
        return { content: raw }
    }
    return { data: raw }
}

export async function resolveSelectedStores(storeIds: string[]): Promise<ResolveResult> {
    const targetFiles = Object.values(ID_TO_FILE_AND_KIND).map((m) => m.filename)
    const start = process.cwd()
    const repoRoot = findRepoRoot(start, targetFiles) || process.cwd()

    const stores: StoreEnvelopeStore[] = []
    const statuses: Record<string, 'ok' | 'error'> = {}
    let totalBytes = 0

    for (const id of storeIds) {
        const map = ID_TO_FILE_AND_KIND[id]
        if (!map) {
            statuses[id] = 'error'
            continue
        }
        const filePath = path.join(repoRoot, map.filename)
        try {
            const stat = fs.statSync(filePath)
            totalBytes += stat.size
            if (totalBytes > SOFT_CAP_BYTES) {
                throw new Error(`Dataset size exceeds 100MB cap`)
            }
            const raw = fs.readFileSync(filePath, 'utf8')
            const json = JSON.parse(raw)
            const data = normalizeData(map.kind, json)
            stores.push({
                id,
                name: map.name,
                kind: map.kind,
                data,
                meta: { bytes: stat.size, source: filePath }
            })
            statuses[id] = 'ok'
        } catch (e) {
            statuses[id] = 'error'
        }
    }

    const envelope: StoreEnvelope = { version: '1', stores }
    const datasetHash = crypto.createHash('sha256').update(JSON.stringify(envelope)).digest('hex')

    return { envelope, totalBytes, datasetHash, statuses }
}
