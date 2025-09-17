import type { Embeddings } from '@langchain/core/embeddings'

export type LoggerLike = {
    debug?: (...args: any[]) => void
    info?: (...args: any[]) => void
    warn?: (...args: any[]) => void
    error?: (...args: any[]) => void
}

export const logWithFallback = (
    logger: LoggerLike | undefined,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: any
) => {
    const payload = meta !== undefined ? [message, meta] : [message]
    const target = logger?.[level]
    if (typeof target === 'function') {
        target(...payload)
        return
    }
    const fallback =
        level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'info' ? console.info : console.debug
    fallback(...payload)
}

export const isTypedArray = (val: unknown): val is ArrayBufferView => ArrayBuffer.isView(val as any) && !(val instanceof DataView)

const normalizeEmbeddingRow = (row: any): any => {
    if (!row) return row
    if (isTypedArray(row)) return Array.from(row as any)
    if (Array.isArray(row)) return row
    if (typeof row === 'object' && typeof (row as any).length === 'number') {
        try {
            return Array.from(row as any)
        } catch (_) {
            return row
        }
    }
    return row
}

const normalizeEmbeddingResult = (result: any, expectNested: boolean) => {
    if (expectNested) {
        if (!Array.isArray(result)) return result
        return result.map((row) => normalizeEmbeddingRow(row))
    }
    return normalizeEmbeddingRow(result)
}

export const describeEmbeddingResult = (result: any) => {
    if (!Array.isArray(result)) {
        return `type=${result ? result.constructor?.name || typeof result : 'undefined'} rows=not-array`
    }
    const rows = result.length
    const first = rows > 0 ? result[0] : undefined
    const firstType = first ? (Array.isArray(first) ? 'array' : first.constructor?.name || typeof first) : 'undefined'
    const firstLen = (() => {
        if (!first) return 0
        if (Array.isArray(first)) return first.length
        if (isTypedArray(first)) {
            const typed: any = first
            if (typeof typed.length === 'number') return typed.length
            if (typeof typed.byteLength === 'number') return typed.byteLength
        }
        return 0
    })()
    return `rows=${rows} firstType=${firstType} firstLength=${firstLen}`
}

export const hasValidEmbeddingRows = (result: any) => {
    return (
        Array.isArray(result) &&
        (result.length === 0 || Array.isArray(result[0]) || isTypedArray(result[0]))
    )
}

export const ensureEmbeddingAdapters = (embeddings: Embeddings | undefined, logger?: LoggerLike) => {
    if (!embeddings || (embeddings as any).__flowiseNormalizedVectorOutput) {
        return
    }

    const patchMethod = (methodName: 'embedDocuments' | 'embedQuery', expectNested: boolean) => {
        const original = (embeddings as any)[methodName]
        if (typeof original !== 'function') return
        ;(embeddings as any)[methodName] = async (...args: any[]) => {
            try {
                const result = await original.apply(embeddings, args)
                const normalized = normalizeEmbeddingResult(result, expectNested)
                if (normalized !== result) {
                    logWithFallback(logger, 'debug', `[embeddings] normalized ${methodName} output`, {
                        method: methodName,
                        description: describeEmbeddingResult(result)
                    })
                }
                return normalized
            } catch (error: any) {
                logWithFallback(logger, 'error', `[embeddings] ${methodName} failed`, {
                    error: error?.message || String(error)
                })
                throw error
            }
        }
    }

    const originalRetry = (embeddings as any).embeddingWithRetry
    if (typeof originalRetry === 'function' && !(embeddings as any).__flowisePatchedRetry) {
        ;(embeddings as any).embeddingWithRetry = async (...args: any[]) => {
            try {
                const response = await originalRetry.apply(embeddings, args)
                const meta = (() => {
                    const data = response?.data
                    if (!data) return { hasData: false }
                    return {
                        hasData: Array.isArray(data),
                        rows: Array.isArray(data) ? data.length : undefined,
                        firstType: Array.isArray(data) && data.length > 0 ? data[0]?.constructor?.name || typeof data[0] : undefined
                    }
                })()
                logWithFallback(logger, 'debug', '[embeddings] embeddingWithRetry response meta', meta)
                return response
            } catch (error: any) {
                logWithFallback(logger, 'error', '[embeddings] embeddingWithRetry failed', {
                    error: error?.message || String(error)
                })
                throw error
            }
        }
        Object.defineProperty(embeddings, '__flowisePatchedRetry', {
            value: true,
            enumerable: false,
            configurable: false
        })
    }

    patchMethod('embedDocuments', true)
    patchMethod('embedQuery', false)

    Object.defineProperty(embeddings, '__flowiseNormalizedVectorOutput', {
        value: true,
        enumerable: false,
        configurable: false
    })
    logWithFallback(logger, 'debug', '[embeddings] normalization adapter attached')
}
