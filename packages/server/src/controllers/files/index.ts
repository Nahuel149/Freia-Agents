import path from 'path'
import { NextFunction, Request, Response } from 'express'
import { getFilesListFromStorage, getStoragePath, removeSpecificFileFromStorage } from 'flowise-components'
import { updateStorageUsage } from '../../utils/quotaUsage'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

const getAllFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = 'bypass-org'
        const apiResponse = await getFilesListFromStorage(orgId)
        const filesList = apiResponse.map((file: any) => ({
            ...file,
            // replace org id because we don't want to expose it
            path: file.path.replace(getStoragePath(), '').replace(`${path.sep}${orgId}${path.sep}`, '')
        }))
        return res.json(filesList)
    } catch (error) {
        next(error)
    }
}

const deleteFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = 'bypass-org'
        const filePath = req.query.path as string
        const paths = filePath.split(path.sep).filter((path) => path !== '')
        const { totalSize } = await removeSpecificFileFromStorage(orgId, ...paths)
        // Skip storage usage tracking in OSS mode
        return res.json({ message: 'file_deleted' })
    } catch (error) {
        next(error)
    }
}

export default {
    getAllFiles,
    deleteFile
}
