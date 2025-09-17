import { flatten } from 'lodash'
import { Embeddings } from '@langchain/core/embeddings'
import { Document } from '@langchain/core/documents'
import { ICommonObject, INode, INodeData, INodeOutputsValue, INodeParams, IndexingResult } from '../../../src/Interface'
import { getBaseClasses, getCredentialData, getCredentialParam } from '../../../src/utils'
import { addMMRInputParams, resolveVectorStoreOrRetriever } from '../VectorStoreUtils'
import { MongoDBAtlasVectorSearch } from './core'

// TODO: Add ability to specify env variable and use singleton pattern (i.e initialize MongoDB on server and pass to component)
class MongoDBAtlas_VectorStores implements INode {
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
        this.label = 'MongoDB Atlas'
        this.name = 'mongoDBAtlas'
        this.version = 1.0
        this.description = `Upsert embedded data and perform similarity or mmr search upon query using MongoDB Atlas, a managed cloud mongodb database`
        this.type = 'MongoDB Atlas'
        this.icon = 'mongodb.svg'
        this.category = 'Vector Stores'
        this.baseClasses = [this.type, 'VectorStoreRetriever', 'BaseRetriever']
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['mongoDBUrlApi']
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
                label: 'Database',
                name: 'databaseName',
                placeholder: '<DB_NAME>',
                type: 'string'
            },
            {
                label: 'Collection Name',
                name: 'collectionName',
                placeholder: '<COLLECTION_NAME>',
                type: 'string'
            },
            {
                label: 'Index Name',
                name: 'indexName',
                placeholder: '<VECTOR_INDEX_NAME>',
                type: 'string'
            },
            {
                label: 'Content Field',
                name: 'textKey',
                description: 'Name of the field (column) that contains the actual content',
                type: 'string',
                default: 'text',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Embedded Field',
                name: 'embeddingKey',
                description: 'Name of the field (column) that contains the Embedding',
                type: 'string',
                default: 'embedding',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Mongodb Metadata Filter',
                name: 'mongoMetadataFilter',
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
                label: 'MongoDB Retriever',
                name: 'retriever',
                baseClasses: this.baseClasses
            },
            {
                label: 'MongoDB Vector Store',
                name: 'vectorStore',
                baseClasses: [this.type, ...getBaseClasses(MongoDBAtlasVectorSearch)]
            }
        ]
    }

    //@ts-ignore
    vectorStoreMethods = {
        async upsert(nodeData: INodeData, options: ICommonObject): Promise<Partial<IndexingResult>> {
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const databaseName = nodeData.inputs?.databaseName as string
            const collectionName = nodeData.inputs?.collectionName as string
            const indexName = nodeData.inputs?.indexName as string
            let textKey = nodeData.inputs?.textKey as string
            let embeddingKey = nodeData.inputs?.embeddingKey as string
            const embeddings = nodeData.inputs?.embeddings as Embeddings

            let mongoDBConnectUrl = getCredentialParam('mongoDBConnectUrl', credentialData, nodeData)

            const docs = nodeData.inputs?.document as Document[] | Document | undefined

            // Normalize documents: accept single doc or array; support snake_case page_content
            const flattenDocs = Array.isArray(docs) ? flatten(docs) : docs ? [docs] : []
            const finalDocs: Document[] = []
            for (const raw of flattenDocs as any[]) {
                if (!raw) continue
                const pageContentVal = raw.pageContent ?? raw.page_content
                if (pageContentVal === undefined || pageContentVal === null) continue
                const pageContent = String(pageContentVal)
                if (!pageContent.trim()) continue
                const metadata = raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? { ...raw.metadata } : {}
                finalDocs.push(new Document({ pageContent, metadata, id: (raw as any).id }))
            }

            try {
                if (!textKey || textKey === '') textKey = 'text'
                if (!embeddingKey || embeddingKey === '') embeddingKey = 'embedding'

                // Embeddings preflight: ensure provider works and returns correct shape
                try {
                    const probe = await (embeddings as any).embedDocuments(['__flowise_probe__'])
                    if (!Array.isArray(probe) || (probe.length > 0 && !Array.isArray(probe[0]))) {
                        throw new Error('Unexpected embeddings output shape')
                    }
                } catch (err: any) {
                    const msg = err?.message || String(err)
                    throw new Error(`Embeddings preflight failed: ${msg}`)
                }

                const mongoDBAtlasVectorSearch = new MongoDBAtlasVectorSearch(embeddings, {
                    connectionDetails: { mongoDBConnectUrl, databaseName, collectionName },
                    indexName,
                    textKey,
                    embeddingKey
                })
                if (finalDocs.length) {
                    await mongoDBAtlasVectorSearch.addDocuments(finalDocs)
                }

                return { numAdded: finalDocs.length, addedDocs: finalDocs }
            } catch (e) {
                if (e instanceof Error) throw e
                throw new Error(String(e))
            }
        }
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const databaseName = nodeData.inputs?.databaseName as string
        const collectionName = nodeData.inputs?.collectionName as string
        const indexName = nodeData.inputs?.indexName as string
        let textKey = nodeData.inputs?.textKey as string
        let embeddingKey = nodeData.inputs?.embeddingKey as string
        const embeddings = nodeData.inputs?.embeddings as Embeddings
        const mongoMetadataFilter = nodeData.inputs?.mongoMetadataFilter as object

        let mongoDBConnectUrl = getCredentialParam('mongoDBConnectUrl', credentialData, nodeData)

        const mongoDbFilter: MongoDBAtlasVectorSearch['FilterType'] = {}

        try {
            if (!textKey || textKey === '') textKey = 'text'
            if (!embeddingKey || embeddingKey === '') embeddingKey = 'embedding'

            const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
                connectionDetails: { mongoDBConnectUrl, databaseName, collectionName },
                indexName,
                textKey,
                embeddingKey
            })

            if (mongoMetadataFilter) {
                const metadataFilter = typeof mongoMetadataFilter === 'object' ? mongoMetadataFilter : JSON.parse(mongoMetadataFilter)

                for (const key in metadataFilter) {
                    mongoDbFilter.preFilter = {
                        ...mongoDbFilter.preFilter,
                        [key]: {
                            $eq: metadataFilter[key]
                        }
                    }
                }
            }

            return resolveVectorStoreOrRetriever(nodeData, vectorStore, mongoDbFilter)
        } catch (e) {
            throw new Error(e)
        }
    }
}

module.exports = { nodeClass: MongoDBAtlas_VectorStores }
