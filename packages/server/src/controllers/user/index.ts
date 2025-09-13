import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { getHash } from '../../oss/utils/encryption.util'

const isUUID = (v: string) => /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(v)

// GET /user?id=...
const getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = (req.query?.id as string) || (req.user && (req.user as any).id)
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(require('../../oss/database/entities/user.entity').User)

        // If valid UUID, fetch by id
        if (id && isUUID(id)) {
            const user = await repo.findOne({ where: { id } })
            if (!user) return res.status(404).json({ message: 'User not found' })
            const { credential, ...safe } = user
            return res.json(safe)
        }

        // Fallbacks for OSS payloads (non-uuid ids)
        if (req.user) {
            const u: any = req.user
            return res.json({ id: u.id || 'oss-admin', name: u.name || 'OSS Admin', email: u.email || 'admin@localhost' })
        }

        // If id looks like an email, try email lookup
        const q = (id || '').toString()
        if (q && q.includes('@')) {
            const user = await repo.findOne({ where: { email: q.toLowerCase() } })
            if (!user) return res.status(404).json({ message: 'User not found' })
            const { credential, ...safe } = user
            return res.json(safe)
        }

        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing or invalid user identifier')
    } catch (e) {
        next(e)
    }
}

// PUT /user  { id, name, email, password? }
const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, name, email, password } = req.body || {}
        if (!id && !req.user) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing user id')
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(require('../../oss/database/entities/user.entity').User)

        // UUID path: update DB record
        if (id && isUUID(id)) {
            const user = await repo.findOne({ where: { id } })
            if (!user) return res.status(404).json({ message: 'User not found' })
            if (name) user.name = name
            if (email) user.email = String(email).toLowerCase().trim()
            if (password) user.credential = getHash(password)
            const saved = await repo.save(user)
            const { credential, ...safe } = saved
            return res.json(safe)
        }

        // OSS fallback: echo back updated payload without persistence (no UUID id)
        const current: any = req.user || {}
        const safe = {
            id: current.id || 'oss-admin',
            name: name || current.name || 'OSS Admin',
            email: (email || current.email || 'admin@localhost').toLowerCase()
        }
        return res.json(safe)
    } catch (e) {
        next(e)
    }
}

export default { getUser, updateUser }
