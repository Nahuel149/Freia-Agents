import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Minimal Role entity for open-source mode.
 * Only includes basic fields required by OSS code paths.
 */
export enum GeneralRole {
    OWNER = 'owner',
    MEMBER = 'member',
    PERSONAL_WORKSPACE = 'personal workspace'
}

@Entity()
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

    @Column({ type: 'text', nullable: true })
    organizationId?: string | null
}