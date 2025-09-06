import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Contact } from './contact.entity'
import { Deal } from './deal.entity'

export enum TaskStatus {
    TODO = 'todo',
    DONE = 'done'
}

export enum TaskPriority {
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

@Entity()
export class Task {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 255 })
    name!: string

    @Column({ type: 'date' })
    dueDate!: Date

    @Column({
        type: 'enum',
        enum: TaskPriority,
        default: TaskPriority.MEDIUM
    })
    priority!: TaskPriority

    @Column({
        type: 'enum',
        enum: TaskStatus,
        default: TaskStatus.TODO
    })
    status!: TaskStatus

    @Column({ type: 'uuid', nullable: true })
    associatedContactId?: string

    @ManyToOne(() => Contact)
    @JoinColumn({ name: 'associatedContactId' })
    associatedContact?: Contact

    @Column({ type: 'uuid', nullable: true })
    associatedDealId?: string

    @ManyToOne(() => Deal)
    @JoinColumn({ name: 'associatedDealId' })
    associatedDeal?: Deal

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date
}