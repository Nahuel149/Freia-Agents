import { z } from 'zod'
import { DynamicStructuredTool } from '../OpenAPIToolkit/core'
import { secureFetch } from '../../../src/httpSecurity'

export const desc = `Use this when you want to execute a POST request to create or update a resource.`

export interface Headers {
    [key: string]: string
}

export interface Body {
    [key: string]: any
}

export interface RequestParameters {
    headers?: Headers
    body?: Body
    url?: string
    description?: string
    name?: string
    bodySchema?: string
    maxOutputLength?: number
    queryParamsSchema?: string
}

// Base schema for POST request
const createRequestsPostSchema = (bodySchema?: string, queryParamsSchema?: string) => {
    // Build body schema
    let bodyZod: z.ZodTypeAny | undefined
    if (bodySchema) {
        try {
            const parsedSchema = JSON.parse(bodySchema)
            const bodyParamsObject: Record<string, z.ZodTypeAny> = {}

            Object.entries(parsedSchema).forEach(([key, config]: [string, any]) => {
                let zodType: z.ZodTypeAny = z.string()

                // Handle different types
                if (config.type === 'number') {
                    zodType = z.number()
                } else if (config.type === 'boolean') {
                    zodType = z.boolean()
                } else if (config.type === 'object') {
                    zodType = z.record(z.any())
                } else if (config.type === 'array') {
                    zodType = z.array(z.any())
                }

                // Add description
                if (config.description) {
                    zodType = zodType.describe(config.description)
                }

                // Make optional if not required
                if (!config.required) {
                    zodType = zodType.optional()
                }

                bodyParamsObject[key] = zodType
            })

            if (Object.keys(bodyParamsObject).length > 0) {
                bodyZod = z.object(bodyParamsObject).describe('Request body parameters')
            }
        } catch (error) {
            console.warn('Failed to parse bodySchema:', error)
        }
    }

    if (!bodyZod) {
        bodyZod = z.record(z.any()).optional().describe('Optional body data to include in the request')
    }

    // Build query params schema
    let queryZod: z.ZodTypeAny | undefined
    if (queryParamsSchema) {
        try {
            const parsedSchema = JSON.parse(queryParamsSchema)
            const queryParamsObject: Record<string, z.ZodTypeAny> = {}

            Object.entries(parsedSchema).forEach(([key, config]: [string, any]) => {
                let zodType: z.ZodTypeAny = z.string()

                // Handle different types
                if (config.type === 'number') {
                    zodType = z.string().transform((val) => Number(val))
                } else if (config.type === 'boolean') {
                    zodType = z.string().transform((val) => val === 'true')
                }

                // Add description
                if (config.description) {
                    zodType = zodType.describe(config.description)
                }

                // Make optional if not required
                if (!config.required) {
                    zodType = zodType.optional()
                }

                queryParamsObject[key] = zodType
            })

            if (Object.keys(queryParamsObject).length > 0) {
                queryZod = z.object(queryParamsObject).optional().describe('Query parameters for the request')
            }
        } catch (error) {
            console.warn('Failed to parse queryParamsSchema:', error)
        }
    }

    if (!queryZod) {
        queryZod = z.record(z.string()).optional().describe('Optional query parameters to include in the request')
    }

    return z.object({
        body: bodyZod,
        queryParams: queryZod
    })
}

export class RequestsPostTool extends DynamicStructuredTool {
    url = ''
    maxOutputLength = Infinity
    headers = {}
    body = {}
    bodySchema?: string
    queryParamsSchema?: string

    constructor(args?: RequestParameters) {
        const schema = createRequestsPostSchema(args?.bodySchema, args?.queryParamsSchema)

        const toolInput = {
            name: args?.name || 'requests_post',
            description: args?.description || desc,
            schema: schema,
            baseUrl: '',
            method: 'POST',
            headers: args?.headers || {}
        }
        super(toolInput)
        this.url = args?.url ?? this.url
        this.headers = args?.headers ?? this.headers
        this.body = args?.body ?? this.body
        this.maxOutputLength = args?.maxOutputLength ?? this.maxOutputLength
        this.bodySchema = args?.bodySchema
        this.queryParamsSchema = args?.queryParamsSchema
    }

    /** @ignore */
    async _call(arg: any): Promise<string> {
        const params = { ...arg }

        try {
            const inputUrl = this.url
            if (!inputUrl) {
                throw new Error('URL is required for POST request')
            }

            // Build final URL with path/query params
            let finalUrl = inputUrl
            const queryParams: Record<string, string> = {}

            if (this.queryParamsSchema && params.queryParams && Object.keys(params.queryParams).length > 0) {
                try {
                    const parsedSchema = JSON.parse(this.queryParamsSchema)
                    const pathParams: Array<{ key: string; value: string }> = []

                    Object.entries(params.queryParams).forEach(([key, value]) => {
                        const paramConfig = parsedSchema[key]
                        if (paramConfig && value !== undefined && value !== null) {
                            if (paramConfig.in === 'path') {
                                const pathPattern = new RegExp(`:${key}\\b`, 'g')
                                if (finalUrl.includes(`:${key}`)) {
                                    finalUrl = finalUrl.replace(pathPattern, encodeURIComponent(String(value)))
                                } else {
                                    pathParams.push({ key, value: String(value) })
                                }
                            } else if (paramConfig.in === 'query') {
                                queryParams[key] = String(value)
                            }
                        }
                    })

                    if (pathParams.length > 0) {
                        let urlPath = finalUrl
                        if (urlPath.endsWith('/')) {
                            urlPath = urlPath.slice(0, -1)
                        }
                        pathParams.forEach(({ value }) => {
                            urlPath += `/${encodeURIComponent(value)}`
                        })
                        finalUrl = urlPath
                    }

                    if (Object.keys(queryParams).length > 0) {
                        const url = new URL(finalUrl)
                        Object.entries(queryParams).forEach(([key, value]) => {
                            url.searchParams.append(key, value)
                        })
                        finalUrl = url.toString()
                    }
                } catch (error) {
                    console.warn('Failed to process queryParamsSchema:', error)
                }
            } else if (params.queryParams && Object.keys(params.queryParams).length > 0) {
                const url = new URL(finalUrl)
                Object.entries(params.queryParams).forEach(([key, value]) => {
                    url.searchParams.append(key, String(value))
                })
                finalUrl = url.toString()
            }

            let inputBody = {
                ...this.body
            }

            if (this.bodySchema && params.body && Object.keys(params.body).length > 0) {
                inputBody = {
                    ...inputBody,
                    ...params.body
                }
            }

            const requestHeaders = {
                'Content-Type': 'application/json',
                ...(params.headers || {}),
                ...this.headers
            }

            const res = await secureFetch(finalUrl, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(inputBody)
            })

            if (!res.ok) {
                throw new Error(`HTTP Error ${res.status}: ${res.statusText}`)
            }

            const text = await res.text()
            return text.slice(0, this.maxOutputLength)
        } catch (error) {
            throw new Error(`Failed to make POST request: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }
}
