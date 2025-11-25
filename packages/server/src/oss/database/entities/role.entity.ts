import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export enum GeneralRole {
    OWNER = 'owner',
    MEMBER = 'member',
    PERSONAL_WORKSPACE = 'personal workspace'
}

@Entity('role')
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100 })
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string | null

    // Permissions stored as JSON string (defaults to empty array)
    @Column({ type: 'text', default: '[]' })
    permissions!: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ type: 'uuid', nullable: true })
    createdBy?: string | null

    @Column({ type: 'uuid', nullable: true })
    updatedBy?: string | null

    // Organization optional and stored as uuid in DB
    @Column({ type: 'uuid', nullable: true })
    organizationId?: string | null
}
