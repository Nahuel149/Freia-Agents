import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'price_approval_requests' })
export class PriceApprovalRequest {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ name: 'quote_id', type: 'varchar' })
    quoteId: string

    @Column({ name: 'client_id', type: 'varchar', nullable: true })
    clientId?: string | null

    @Column({ name: 'sale_id', type: 'int', nullable: true })
    saleId?: number | null

    @Column({ name: 'requested_discount', type: 'numeric' })
    requestedDiscount: number

    @Column({ name: 'requested_total', type: 'numeric', nullable: true })
    requestedTotal?: number | null

    @Column({ type: 'text', nullable: true })
    reason?: string | null

    @Column({ name: 'client_phone', type: 'varchar', nullable: true })
    clientPhone?: string | null

    @Column({ type: 'varchar', length: 16, default: 'medium' })
    priority: string

    @Column({ name: 'estimated_response_time', type: 'int', nullable: true })
    estimatedResponseTime?: number | null

    @Column({ type: 'varchar', length: 16, default: 'pending' })
    status: string

    @Column({ type: 'varchar', nullable: true })
    reviewer?: string | null

    @Column({ name: 'approved_discount', type: 'numeric', nullable: true })
    approvedDiscount?: number | null

    @Column({ name: 'decision_notes', type: 'text', nullable: true })
    decisionNotes?: string | null

    @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
    resolvedAt?: Date | null

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date
}
