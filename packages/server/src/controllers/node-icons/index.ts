import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

// Returns specific component node icon via name
const getSingleNodeIcon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        if (Object.prototype.hasOwnProperty.call(appServer.nodesPool.componentNodes, req.params.name)) {
            const nodeInstance = appServer.nodesPool.componentNodes[req.params.name]
            if (nodeInstance.icon === undefined) {
                throw new InternalFlowiseError(
                    StatusCodes.NOT_FOUND,
                    `Error: nodeIconController.getSingleNodeIcon - Node ${req.params.name} icon not found`
                )
            }

            if (nodeInstance.icon.endsWith('.svg') || nodeInstance.icon.endsWith('.png') || nodeInstance.icon.endsWith('.jpg')) {
                const filepath = nodeInstance.icon
                // If file exists, send it; else return a 1x1 transparent PNG to avoid noisy errors in OSS
                if (fs.existsSync(filepath)) {
                    res.sendFile(filepath)
                } else {
                    const pixel = Buffer.from(
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
                        'base64'
                    )
                    res.setHeader('Content-Type', 'image/png')
                    res.status(200).send(pixel)
                }
            } else {
                throw new InternalFlowiseError(
                    StatusCodes.PRECONDITION_FAILED,
                    `Error: nodeIconController.getSingleNodeIcon - Node ${req.params.name} icon is missing icon`
                )
            }
        } else {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: nodeIconController.getSingleNodeIcon - Node ${req.params.name} not found`
            )
        }
    } catch (error) {
        next(error)
    }
}

export default {
    getSingleNodeIcon
}
