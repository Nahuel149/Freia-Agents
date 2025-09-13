import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm'

@Entity()
export class ClientAccount {
    @PrimaryColumn({ type: 'varchar' })
    clientId: string

    @Column({ type: 'varchar', nullable: true })
    name?: string

    @Column({ type: 'varchar', nullable: true })
    company?: string

    @Column({ type: 'varchar', nullable: true })
    email?: string

    @UpdateDateColumn({ type: 'timestamp' })
    updatedDate: Date
}

