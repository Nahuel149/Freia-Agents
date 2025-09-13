import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity()
export class AgentEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index()
    @Column({ type: 'varchar' })
    type: string // conversation | lead | qualified | proposal | sale | follow_up | feedback

    @CreateDateColumn({ type: 'timestamp' })
    ts: Date

    @Index()
    @Column({ type: 'varchar', nullable: true })
    agentId?: string

    @Index()
    @Column({ type: 'varchar', nullable: true })
    clientId?: string

    @Column({ type: 'varchar', nullable: true })
    clientName?: string

    @Column({ type: 'text', nullable: true })
    message?: string

    @Column({ type: 'varchar', nullable: true })
    productId?: string

    @Column({ type: 'int', nullable: true })
    qty?: number

    @Column({ type: 'numeric', nullable: true })
    amount?: number

    @Column({ type: 'text', nullable: true })
    metadata?: string // JSON string
}

