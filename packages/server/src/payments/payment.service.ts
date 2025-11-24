import crypto from 'crypto'
import { dataSource } from '../utils/typeormDataSource'
import { PaymentTransaction, PaymentProvider, PaymentStatus } from '../database/entities/PaymentTransaction'

export class PaymentService {
    private repo = dataSource.getRepository(PaymentTransaction)

    private computeHash(payload: { provider: PaymentProvider; externalRef: string; amountCents: number; currency: string }) {
        const base = `${payload.provider}|${payload.externalRef}|${payload.amountCents}|${payload.currency}`
        return crypto.createHash('sha256').update(base).digest('hex')
    }

    async upsertFromWebhook(payload: {
        provider: PaymentProvider
        externalRef: string
        status: PaymentStatus
        amountCents: number
        currency: string
        metadata: any
    }) {
        let tx = await this.repo.findOne({ where: { provider: payload.provider, externalRef: payload.externalRef } })
        if (!tx) {
            tx = this.repo.create({
                provider: payload.provider,
                externalRef: payload.externalRef,
                status: payload.status,
                amountCents: payload.amountCents,
                currency: payload.currency,
                gatewayMetadata: payload.metadata
            })
        } else {
            if (tx.status === 'COMPLETED') return tx // idempotencia: no reprocesar completados
            tx.status = payload.status
            tx.gatewayMetadata = payload.metadata
        }
        tx.integrityHash = this.computeHash(tx)
        return this.repo.save(tx)
    }
}
