import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Lightweight replica of enterprise Workspace entity used in open-source (OSS) mode.
 * Only fields required by OSS code paths are preserved. Feel free to extend as needed.
 */
export enum WorkspaceName {
    DEFAULT_WORKSPACE = 'Default Workspace',
    DEFAULT_PERSONAL_WORKSPACE = 'Personal Workspace',
}

@Entity()
export class Workspace {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100, default: WorkspaceName.DEFAULT_PERSONAL_WORKSPACE })
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string | null

    // Organization support is required by some OSS code paths.
    @Column({ type: 'uuid', nullable: false })
    organizationId!: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    // Creator / updater references are optional in OSS mode.
    @Column({ type: 'uuid', nullable: true })
    createdBy?: string | null

    @Column({ type: 'uuid', nullable: true })
    updatedBy?: string | null
}