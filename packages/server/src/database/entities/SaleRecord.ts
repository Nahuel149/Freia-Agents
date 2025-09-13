import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity()
export class SaleRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string

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

    @Column({ type: 'numeric', default: 0 })
    totalAmount: number

    @Column({ type: 'text', nullable: true })
    items?: string // JSON array of {productId, name, qty, price, total}
}

