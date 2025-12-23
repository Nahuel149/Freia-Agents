import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import logger from '../../utils/logger'

// we need eslint because we have to pass next arg for the error middleware
// eslint-disable-next-line
async function errorHandlerMiddleware(err: InternalFlowiseError, req: Request, res: Response, next: NextFunction) {
    const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
    if (err.message.includes('401 Incorrect API key provided'))
        err.message = '401 Invalid model key or Incorrect local model configuration.'
    let displayedError = {
        statusCode,
        success: false,
        message: err.message,
        // Provide error stack trace only in development
        stack: process.env.NODE_ENV === 'development' ? err.stack : {}
    }

    const reqId = (req as any).requestId || res.getHeader('x-request-id')
    // Log enriched error details with correlation id
    logger.error(`Error encountered [reqId=${reqId}] ${req.method} ${req.url} -> ${statusCode}: ${err.message}`)
    if (!req.body || !req.body.streaming || req.body.streaming === 'false') {
        res.setHeader('Content-Type', 'application/json')
        if (reqId) res.setHeader('x-request-id', String(reqId))
        res.status(displayedError.statusCode).json(displayedError)
    }
}

export default errorHandlerMiddleware
