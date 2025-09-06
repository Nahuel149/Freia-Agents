import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Account } from './account.entity'

export enum RelationshipStatus {
    INFLUENCER = 'influencer',
    DECISION_MAKER = 'decision-maker',
    BLOCKER = 'blocker',
    UNKNOWN = 'unknown'
}

@Entity()
export class Contact {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100 })
    name!: string

    @Column({ type: 'uuid' })
    accountId!: string

    @ManyToOne(() => Account)
    @JoinColumn({ name: 'accountId' })
    account!: Account

    @Column({ type: 'varchar', length: 100, nullable: true })
    role?: string

    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string

    @Column({ type: 'varchar', length: 50, nullable: true })
    phone?: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    linkedinUrl?: string

    @Column({
        type: 'enum',
        enum: RelationshipStatus,
        default: RelationshipStatus.UNKNOWN
    })
    relationshipStatus!: RelationshipStatus

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date
}