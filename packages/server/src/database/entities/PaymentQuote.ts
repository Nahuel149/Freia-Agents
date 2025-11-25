import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'payment_quote' })
export class PaymentQuote {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ name: 'amount_cents', type: 'integer' })
    amountCents: number

    @Column({ type: 'varchar', length: 8 })
    currency: string

    @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
    userEmail?: string | null

    @Column({ name: 'user_id', type: 'uuid', nullable: true })
    userId?: string | null

    @Column({ type: 'text', nullable: true })
    description?: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date
}
