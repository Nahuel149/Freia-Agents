import { flatten } from 'lodash'
import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeStoreParams, PineconeStore } from '@langchain/pinecone'
import { Embeddings } from '@langchain/core/embeddings'
import { Document } from '@langchain/core/documents'
import { VectorStore } from '@langchain/core/vectorstores'
import { ICommonObject, INode, INodeData, INodeOutputsValue, INodeParams, IndexingResult } from '../../../src/Interface'
import { FLOWISE_CHATID, getBaseClasses, getCredentialData, getCredentialParam } from '../../../src/utils'
import { addMMRInputParams, howToUseFileUpload, resolveVectorStoreOrRetriever } from '../VectorStoreUtils'
import { index } from '../../../src/indexing'
import {
    ensureEmbeddingAdapters,
    describeEmbeddingResult,
    hasValidEmbeddingRows,
    logWithFallback,
    LoggerLike
} from '../../../src/embeddingUtils'

class Pinecone_VectorStores implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    badge: string
    baseClasses: string[]
    inputs: INodeParams[]
    credential: INodeParams
    outputs: INodeOutputsValue[]

    constructor() {
        this.label = 'Pinecone'
        this.name = 'pinecone'
        this.version = 5.0
        this.type = 'Pinecone'
        this.icon = 'pinecone.svg'
        this.category = 'Vector Stores'
        this.description = `Upsert embedded data and perform similarity or mmr search using Pinecone, a leading fully managed hosted vector database`
        this.baseClasses = [this.type, 'VectorStoreRetriever', 'BaseRetriever']
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['pineconeApi']
        }
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
                label: 'Record Manager',
                name: 'recordManager',
                type: 'RecordManager',
                description: 'Keep track of the record to prevent duplication',
                optional: true
            },
            {
                label: 'Pinecone Index',
                name: 'pineconeIndex',
                type: 'string'
            },
            {
                label: 'Pinecone Namespace',
                name: 'pineconeNamespace',
                type: 'string',
                placeholder: 'my-first-namespace',
                additionalParams: true,
                optional: true
            },
            {
                label: 'File Upload',
                name: 'fileUpload',
                description: 'Allow file upload on the chat',
                hint: {
                    label: 'How to use',
                    value: howToUseFileUpload
                },
                type: 'boolean',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Pinecone Text Key',
                name: 'pineconeTextKey',
                description: 'The key in the metadata for storing text. Default to `text`',
                type: 'string',
                placeholder: 'text',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Pinecone Metadata Filter',
                name: 'pineconeMetadataFilter',
                type: 'json',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Top K',
                name: 'topK',
                description: 'Number of top results to fetch. Default to 4',
                placeholder: '4',
                type: 'number',
                additionalParams: true,
                optional: true
            }
        ]
        addMMRInputParams(this.inputs)
        this.outputs = [
            {
                label: 'Pinecone Retriever',
                name: 'retriever',
                baseClasses: this.baseClasses
            },
            {
                label: 'Pinecone Vector Store',
                name: 'vectorStore',
                baseClasses: [this.type, ...getBaseClasses(PineconeStore)]
            }
        ]
    }

    //@ts-ignore
    vectorStoreMethods = {
        async upsert(nodeData: INodeData, options: ICommonObject): Promise<Partial<IndexingResult>> {
            const _index = nodeData.inputs?.pineconeIndex as string
            const pineconeNamespace = nodeData.inputs?.pineconeNamespace as string
            const docs = nodeData.inputs?.document as Document[] | Document | undefined
            const embeddings = nodeData.inputs?.embeddings as Embeddings
            const recordManager = nodeData.inputs?.recordManager
            const pineconeTextKey = nodeData.inputs?.pineconeTextKey as string
            const isFileUploadEnabled = nodeData.inputs?.fileUpload as boolean
            const logger = (options?.logger || options?.log) as LoggerLike | undefined

            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const pineconeApiKey = getCredentialParam('pineconeApiKey', credentialData, nodeData)

            // Basic preflight with friendly messages (kept minimal for upstream parity)
            if (!_index || !_index.trim()) {
                throw new Error('Pinecone index name is missing. Please set Pinecone Index on the node.')
            }
            if (!pineconeApiKey || !pineconeApiKey.trim()) {
                throw new Error('Pinecone API key is missing. Please attach a Pinecone credential with a valid API key.')
            }
            if (!embeddings || typeof (embeddings as any).embedDocuments !== 'function') {
                throw new Error('Embeddings instance is missing. Connect an Embeddings node to the Pinecone node.')
            }

            ensureEmbeddingAdapters(embeddings, logger)

            const client = new Pinecone({ apiKey: pineconeApiKey })

            const pineconeIndex = client.Index(_index)

            // Normalize documents: accept single doc or array; handle snake_case keys
            const flattenDocs = Array.isArray(docs) ? flatten(docs) : docs ? [docs] : []
            const finalDocs: Document[] = []
            for (const raw of flattenDocs as any[]) {
                if (!raw) continue
                const pageContentVal = raw.pageContent ?? raw.page_content
                if (pageContentVal === undefined || pageContentVal === null) continue
                const pageContent = String(pageContentVal)
                if (!pageContent.trim()) continue
                const rawMetadata = raw.metadata
                const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata) ? { ...rawMetadata } : {}
                if (isFileUploadEnabled && options.chatId) {
                    ;(metadata as any)[FLOWISE_CHATID] = options.chatId
                }
                finalDocs.push(new Document({ pageContent, metadata, id: (raw as any).id }))
            }

            // Early return if no valid docs
            if (!finalDocs.length) return { numAdded: 0, addedDocs: [] }

            // Embeddings preflight: ensure provider works and returns correct shape
            try {
                const probe = await (embeddings as any).embedDocuments(['__flowise_probe__'])
                if (!hasValidEmbeddingRows(probe)) {
                    const shape = describeEmbeddingResult(probe)
                    throw new Error(`Unexpected embeddings output shape (${shape})`)
                }
                logWithFallback(logger, 'debug', '[pinecone-preflight] embeddings probe successful', {
                    description: describeEmbeddingResult(probe)
                })
            } catch (err: any) {
                const msg = err?.message || String(err)
                logWithFallback(logger, 'error', '[pinecone-preflight] embeddings probe failed', {
                    error: msg
                })
                throw new Error(`Embeddings preflight failed: ${msg}`)
            }

            const obj: PineconeStoreParams = {
                pineconeIndex,
                textKey: pineconeTextKey || 'text'
            }

            if (pineconeNamespace) obj.namespace = pineconeNamespace

            try {
                if (recordManager) {
                    const vectorStore = (await PineconeStore.fromExistingIndex(embeddings, obj)) as unknown as VectorStore
                    await recordManager.createSchema()
                    const res = await index({
                        docsSource: finalDocs,
                        recordManager,
                        vectorStore,
                        options: {
                            cleanup: recordManager?.cleanup,
                            sourceIdKey: recordManager?.sourceIdKey ?? 'source',
                            vectorStoreName: pineconeNamespace
                        }
                    })

                    return res
                } else {
                    await PineconeStore.fromDocuments(finalDocs, embeddings, obj)
                    return { numAdded: finalDocs.length, addedDocs: finalDocs }
                }
            } catch (e) {
                // Preserve the original error message/stack if possible
                if (e instanceof Error) throw e
                throw new Error(String(e))
            }
        },
        async delete(nodeData: INodeData, ids: string[], options: ICommonObject): Promise<void> {
            const _index = nodeData.inputs?.pineconeIndex as string
            const pineconeNamespace = nodeData.inputs?.pineconeNamespace as string
            const embeddings = nodeData.inputs?.embeddings as Embeddings
            const pineconeTextKey = nodeData.inputs?.pineconeTextKey as string
            const recordManager = nodeData.inputs?.recordManager

            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const pineconeApiKey = getCredentialParam('pineconeApiKey', credentialData, nodeData)

            const client = new Pinecone({ apiKey: pineconeApiKey })

            const pineconeIndex = client.Index(_index)

            const obj: PineconeStoreParams = {
                pineconeIndex,
                textKey: pineconeTextKey || 'text'
            }

            if (pineconeNamespace) obj.namespace = pineconeNamespace
            const pineconeStore = new PineconeStore(embeddings, obj)

            try {
                if (recordManager) {
                    const vectorStoreName = pineconeNamespace
                    await recordManager.createSchema()
                    ;(recordManager as any).namespace = (recordManager as any).namespace + '_' + vectorStoreName
                    const keys: string[] = await recordManager.listKeys({})

                    await pineconeStore.delete({ ids: keys })
                    await recordManager.deleteKeys(keys)
                } else {
                    const pineconeStore = new PineconeStore(embeddings, obj)
                    await pineconeStore.delete({ ids })
                }
            } catch (e) {
                throw new Error(e)
            }
        }
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const index = nodeData.inputs?.pineconeIndex as string
        const pineconeNamespace = nodeData.inputs?.pineconeNamespace as string
        const pineconeMetadataFilter = nodeData.inputs?.pineconeMetadataFilter
        const embeddings = nodeData.inputs?.embeddings as Embeddings
        const pineconeTextKey = nodeData.inputs?.pineconeTextKey as string
        const isFileUploadEnabled = nodeData.inputs?.fileUpload as boolean

        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const pineconeApiKey = getCredentialParam('pineconeApiKey', credentialData, nodeData)

        const client = new Pinecone({ apiKey: pineconeApiKey })

        const pineconeIndex = client.Index(index)

        const obj: PineconeStoreParams = {
            pineconeIndex,
            textKey: pineconeTextKey || 'text'
        }

        if (pineconeNamespace) obj.namespace = pineconeNamespace
        if (pineconeMetadataFilter) {
            const metadatafilter = typeof pineconeMetadataFilter === 'object' ? pineconeMetadataFilter : JSON.parse(pineconeMetadataFilter)
            obj.filter = metadatafilter
        }
        if (isFileUploadEnabled && options.chatId) {
            obj.filter = obj.filter || {}
            obj.filter.$or = [
                ...(obj.filter.$or || []),
                { [FLOWISE_CHATID]: { $eq: options.chatId } },
                { [FLOWISE_CHATID]: { $exists: false } }
            ]
        }

        const vectorStore = (await PineconeStore.fromExistingIndex(embeddings, obj)) as unknown as VectorStore

        return resolveVectorStoreOrRetriever(nodeData, vectorStore, obj.filter)
    }
}

module.exports = { nodeClass: Pinecone_VectorStores }
