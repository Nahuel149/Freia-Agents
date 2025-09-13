import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm'

@Entity()
export class SupportTicket {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', nullable: true })
    name?: string

    @Column({ type: 'varchar', nullable: true })
    email?: string

    @Column({ type: 'varchar', nullable: true })
    category?: string

    @Column({ type: 'varchar', nullable: true })
    subject?: string

    @Column({ type: 'text' })
    message: string

    @Column({ type: 'text', nullable: true })
    attachments?: string // JSON string array of attachments metadata {originalname,mimetype,size,location?,path?}

    @Column({ type: 'varchar', default: 'OPEN' })
    status: string

    @CreateDateColumn({ type: 'timestamp' })
    createdDate: Date
}

