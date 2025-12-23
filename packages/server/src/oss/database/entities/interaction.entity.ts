import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Contact } from './contact.entity'
import { Deal } from './deal.entity'

export enum InteractionType {
    EMAIL = 'email',
    CALL = 'call',
    MEETING = 'meeting'
}

@Entity()
export class Interaction {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid' })
    contactId!: string

    @ManyToOne(() => Contact)
    @JoinColumn({ name: 'contactId' })
    contact!: Contact

    @Column({ type: 'uuid', nullable: true })
    dealId?: string

    @ManyToOne(() => Deal)
    @JoinColumn({ name: 'dealId' })
    deal?: Deal

    @Column({
        type: 'enum',
        enum: InteractionType
    })
    type!: InteractionType

    @Column({ type: 'timestamp' })
    date!: Date

    @Column({ type: 'text', nullable: true })
    summary?: string

    @Column({ type: 'text', nullable: true })
    nextSteps?: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date
}
