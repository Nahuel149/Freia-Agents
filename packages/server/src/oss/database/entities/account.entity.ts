import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export enum AccountStatus {
    PROSPECT = 'prospect',
    LEAD = 'lead',
    CUSTOMER = 'customer',
    FORMER = 'former'
}

@Entity()
export class Account {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100 })
    name!: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    industry?: string

    @Column({ type: 'int', nullable: true })
    size?: number

    @Column({
        type: 'enum',
        enum: AccountStatus,
        default: AccountStatus.PROSPECT
    })
    status!: AccountStatus

    @Column({ type: 'int', nullable: true })
    healthScore?: number

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date
}
