import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Account } from './account.entity'

export enum DealStage {
    PROSPECTING = 'prospecting',
    QUALIFICATION = 'qualification',
    PROPOSAL = 'proposal',
    NEGOTIATION = 'negotiation',
    CLOSED_WON = 'closed-won',
    CLOSED_LOST = 'closed-lost'
}

@Entity()
export class Deal {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100 })
    name!: string

    @Column({ type: 'uuid' })
    accountId!: string

    @ManyToOne(() => Account)
    @JoinColumn({ name: 'accountId' })
    account!: Account

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    value!: number

    @Column({
        type: 'enum',
        enum: DealStage,
        default: DealStage.PROSPECTING
    })
    stage!: DealStage

    @Column({ type: 'int' })
    probability!: number

    @Column({ type: 'date' })
    expectedCloseDate!: Date

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date
}
