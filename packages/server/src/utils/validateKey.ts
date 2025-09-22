import { Request } from 'express'
import { ChatFlow } from '../database/entities/ChatFlow'
import { ApiKey } from '../database/entities/ApiKey'
import { compareKeys } from './apiKey'
import apikeyService from '../services/apikey'
import { isOssMode } from './ossMode'
import logger from './logger'

const redactKey = (value?: string | null) => {
    if (!value) return undefined
    const trimmed = value.replace(/^Bearer\s+/i, '').trim()
    if (trimmed.length <= 8) {
        return `${trimmed.slice(0, 2)}…`
    }
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}

/**
 * Validate flow API Key, this is needed because Prediction/Upsert API is public
 * @param {Request} req
 * @param {ChatFlow} chatflow
 */
export const validateFlowAPIKey = async (req: Request, chatflow: ChatFlow): Promise<boolean> => {
    const chatFlowApiKeyId = chatflow?.apikeyid
    if (!chatFlowApiKeyId) return true

    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (chatFlowApiKeyId && !authorizationHeader) {
        logger.warn('[api-key] Missing Authorization header for flow', {
            path: req.originalUrl ?? req.url,
            chatflowId: chatflow?.id ?? null
        })
        return false
    }

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (!suppliedKey) {
        logger.warn('[api-key] Authorization header present but no bearer token found', {
            path: req.originalUrl ?? req.url,
            chatflowId: chatflow?.id ?? null,
            headerPreview: redactKey(authorizationHeader)
        })
        return false
    }

    try {
        const apiKey = await apikeyService.getApiKeyById(chatFlowApiKeyId)
        if (!apiKey) {
            logger.warn('[api-key] Chatflow API key record not found', {
                path: req.originalUrl ?? req.url,
                chatflowId: chatflow?.id ?? null
            })
            return false
        }

        const apiSecret = apiKey.apiSecret
        if (isOssMode()) {
            // In OSS mode, ignore workspace ownership checks and only verify the secret
            const isValid = !!apiSecret && compareKeys(apiSecret, suppliedKey)
            if (!isValid) {
                logger.warn('[api-key] Supplied key mismatch (OSS mode)', {
                    path: req.originalUrl ?? req.url,
                    chatflowId: chatflow?.id ?? null,
                    suppliedKey: redactKey(suppliedKey)
                })
            }
            return isValid
        }

        const apiKeyWorkSpaceId = apiKey.workspaceId
        if (!apiKeyWorkSpaceId) return false

        if (apiKeyWorkSpaceId !== chatflow.workspaceId) {
            logger.warn('[api-key] Workspace mismatch for supplied key', {
                path: req.originalUrl ?? req.url,
                chatflowId: chatflow?.id ?? null,
                suppliedKey: redactKey(suppliedKey)
            })
            return false
        }

        if (!apiSecret || !compareKeys(apiSecret, suppliedKey)) {
            logger.warn('[api-key] Supplied key mismatch for chatflow', {
                path: req.originalUrl ?? req.url,
                chatflowId: chatflow?.id ?? null,
                suppliedKey: redactKey(suppliedKey)
            })
            return false
        }

        return true
    } catch (error) {
        logger.error('[api-key] Error validating flow API key', {
            path: req.originalUrl ?? req.url,
            chatflowId: chatflow?.id ?? null,
            error: error instanceof Error ? error.message : error
        })
        return false
    }
}

/**
 * Validate and Get API Key Information
 * @param {Request} req
 * @returns {Promise<{isValid: boolean, apiKey?: ApiKey, workspaceId?: string}>}
 */
export const validateAPIKey = async (req: Request): Promise<{ isValid: boolean; apiKey?: ApiKey; workspaceId?: string }> => {
    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (!authorizationHeader) {
        logger.warn('[api-key] Missing Authorization header for request', {
            path: req.originalUrl ?? req.url
        })
        return { isValid: false }
    }

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (!suppliedKey) {
        logger.warn('[api-key] Authorization header present but no bearer token found', {
            path: req.originalUrl ?? req.url,
            headerPreview: redactKey(authorizationHeader)
        })
        return { isValid: false }
    }

    try {
        const apiKey = await apikeyService.getApiKey(suppliedKey)
        if (!apiKey) {
            logger.warn('[api-key] Supplied key not found', {
                path: req.originalUrl ?? req.url,
                suppliedKey: redactKey(suppliedKey)
            })
            return { isValid: false }
        }

        const apiSecret = apiKey.apiSecret
        if (!apiSecret || !compareKeys(apiSecret, suppliedKey)) {
            logger.warn('[api-key] Supplied key mismatch for generic validation', {
                path: req.originalUrl ?? req.url,
                suppliedKey: redactKey(suppliedKey)
            })
            return { isValid: false, apiKey, workspaceId: apiKey.workspaceId }
        }

        if (isOssMode()) {
            // In OSS mode, do not require a workspace and return a sentinel value for compatibility
            return { isValid: true, apiKey, workspaceId: 'oss-mode' }
        }

        const apiKeyWorkSpaceId = apiKey.workspaceId
        if (!apiKeyWorkSpaceId) {
            logger.warn('[api-key] API key has no workspace assigned', {
                path: req.originalUrl ?? req.url,
                suppliedKey: redactKey(suppliedKey)
            })
            return { isValid: false }
        }

        return { isValid: true, apiKey, workspaceId: apiKey.workspaceId }
    } catch (error) {
        logger.error('[api-key] Error validating request API key', {
            path: req.originalUrl ?? req.url,
            suppliedKey: redactKey(suppliedKey),
            error: error instanceof Error ? error.message : error
        })
        return { isValid: false }
    }
}
