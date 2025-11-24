import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'

export type PaymentProvider = 'MOBBEX' | 'DLOCAL_GO'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED'

@Entity({ name: 'payment_transaction' })
@Unique(['provider', 'externalRef'])
export class PaymentTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 16 })
    provider: PaymentProvider

    @Column({ type: 'varchar', length: 16 })
    status: PaymentStatus

    @Column({ name: 'amount_cents', type: 'integer' })
    amountCents: number

    @Column({ type: 'varchar', length: 8 })
    currency: string

    @Column({ name: 'external_ref', type: 'varchar', length: 128 })
    externalRef: string

    @Column({ name: 'gateway_metadata', type: 'jsonb', nullable: true })
    gatewayMetadata?: Record<string, any> | null

    @Column({ name: 'integrity_hash', type: 'varchar', length: 128, nullable: true })
    integrityHash?: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date
}
