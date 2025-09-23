import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'follow_ups' })
export class FollowUp {
    @PrimaryGeneratedColumn()
    id: number

    @Index()
    @Column({ name: 'customer_id', type: 'int', nullable: true })
    customerId: number | null

    @Column({ name: 'phone_number', type: 'varchar', length: 20 })
    phoneNumber: string

    @Index()
    @Column({ name: 'sale_id', type: 'int', nullable: true })
    saleId: number | null

    @Column({ name: 'follow_up_type', type: 'varchar', length: 50 })
    followUpType: string

    @Index()
    @Column({ name: 'scheduled_at', type: 'timestamp' })
    scheduledAt: Date

    @Index()
    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: string

    @Column({ name: 'attempt_number', type: 'int', default: 1 })
    attemptNumber: number

    @Column({ name: 'max_attempts', type: 'int', default: 3 })
    maxAttempts: number

    @Column({ name: 'message_sent', type: 'text', nullable: true })
    messageSent: string | null

    @Column({ name: 'customer_response', type: 'text', nullable: true })
    customerResponse: string | null

    @Column({ name: 'next_action', type: 'varchar', length: 100, nullable: true })
    nextAction: string | null

    @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
    completedAt: Date | null

    @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date
}
