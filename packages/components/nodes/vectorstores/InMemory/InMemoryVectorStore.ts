import { flatten } from 'lodash'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { Embeddings } from '@langchain/core/embeddings'
import { Document } from '@langchain/core/documents'
import { INode, INodeData, INodeOutputsValue, INodeParams, IndexingResult } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class InMemoryVectorStore_VectorStores implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]
    outputs: INodeOutputsValue[]

    constructor() {
        this.label = 'In-Memory Vector Store'
        this.name = 'memoryVectorStore'
        this.version = 1.0
        this.type = 'Memory'
        this.icon = 'memory.svg'
        this.category = 'Vector Stores'
        this.description = 'In-memory vectorstore that stores embeddings and does an exact, linear search for the most similar embeddings.'
        this.baseClasses = [this.type, 'VectorStoreRetriever', 'BaseRetriever']
        this.inputs = [
            {
                label: 'Document',
                name: 'document',
                type: 'Document',
                list: true,
                optional: true
            },
            {
                label: 'Embeddings',
                name: 'embeddings',
                type: 'Embeddings'
            },
            {
                label: 'Top K',
                name: 'topK',
                description: 'Number of top results to fetch. Default to 4',
                placeholder: '4',
                type: 'number',
                optional: true
            }
        ]
        this.outputs = [
            {
                label: 'Memory Retriever',
                name: 'retriever',
                baseClasses: this.baseClasses
            },
            {
                label: 'Memory Vector Store',
                name: 'vectorStore',
                baseClasses: [this.type, ...getBaseClasses(MemoryVectorStore)]
            }
        ]
    }

    //@ts-ignore
    vectorStoreMethods = {
        async upsert(nodeData: INodeData): Promise<Partial<IndexingResult>> {
            const rawDocs = nodeData.inputs?.document as Document[] | Document | undefined
            const embeddings = nodeData.inputs?.embeddings as Embeddings

            // Normalize input to an array and accept snake_case keys produced by some loaders/APIs
            const flattenDocs = Array.isArray(rawDocs) ? flatten(rawDocs) : rawDocs ? [rawDocs] : []
            const finalDocs: Document[] = []
            for (const raw of flattenDocs as any[]) {
                if (!raw) continue
                const pageContentVal = (raw as any).pageContent ?? (raw as any).page_content
                if (pageContentVal === undefined || pageContentVal === null) continue
                const pageContent = String(pageContentVal)
                if (!pageContent.trim()) continue
                const rawMetadata = (raw as any).metadata
                const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata) ? { ...rawMetadata } : {}
                finalDocs.push(new Document({ pageContent, metadata, id: (raw as any).id }))
            }

            // Avoid calling embeddings on empty list (some providers error when indexing []): treat as no-op
            if (!finalDocs.length) return { numAdded: 0, addedDocs: [] }

            try {
                await MemoryVectorStore.fromDocuments(finalDocs, embeddings)
                return { numAdded: finalDocs.length, addedDocs: finalDocs }
            } catch (e: any) {
                throw new Error(e?.message || String(e))
            }
        }
    }

    async init(nodeData: INodeData): Promise<any> {
        const rawDocs = nodeData.inputs?.document as Document[] | Document | undefined
        const embeddings = nodeData.inputs?.embeddings as Embeddings
        const output = nodeData.outputs?.output as string
        const topK = nodeData.inputs?.topK as string
        const k = topK ? parseFloat(topK) : 4

        // Normalize input to an array and accept snake_case keys
        const flattenDocs = Array.isArray(rawDocs) ? flatten(rawDocs) : rawDocs ? [rawDocs] : []
        const finalDocs: Document[] = []
        for (const raw of flattenDocs as any[]) {
            if (!raw) continue
            const pageContentVal = (raw as any).pageContent ?? (raw as any).page_content
            if (pageContentVal === undefined || pageContentVal === null) continue
            const pageContent = String(pageContentVal)
            if (!pageContent.trim()) continue
            const rawMetadata = (raw as any).metadata
            const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata) ? { ...rawMetadata } : {}
            finalDocs.push(new Document({ pageContent, metadata, id: (raw as any).id }))
        }

        // If there are no valid documents, return an empty store to allow downstream usage
        let vectorStore: any
        if (!finalDocs.length) {
            try {
                vectorStore = new (MemoryVectorStore as any)(embeddings ? { embeddings } : {})
            } catch (_) {
                // Fallback: create a minimal store by indexing a single blank doc
                vectorStore = await MemoryVectorStore.fromDocuments([new Document({ pageContent: ' ' })], embeddings)
            }
        } else {
            vectorStore = await MemoryVectorStore.fromDocuments(finalDocs, embeddings)
        }

        if (output === 'retriever') {
            const retriever = vectorStore.asRetriever(k)
            return retriever
        } else if (output === 'vectorStore') {
            ;(vectorStore as any).k = k
            return vectorStore
        }
        return vectorStore
    }
}

module.exports = { nodeClass: InMemoryVectorStore_VectorStores }
