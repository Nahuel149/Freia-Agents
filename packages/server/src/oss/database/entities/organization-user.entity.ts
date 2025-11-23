import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/**
 * Minimal OrganizationUser entity stub for OSS mode.
 */
export enum OrganizationUserStatus {
    INVITED = 'INVITED',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE'
}

@Entity('organization_user')
export class OrganizationUser {
    @PrimaryColumn({ type: 'uuid' })
    organizationId!: string

    @PrimaryColumn({ type: 'uuid' })
    userId!: string

    @Column({ type: 'uuid', nullable: true })
    roleId?: string | null

    @Column({ type: 'enum', enum: OrganizationUserStatus, default: OrganizationUserStatus.INVITED })
    status!: OrganizationUserStatus

    @CreateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date

    @Column({ type: 'uuid', nullable: true })
    createdBy?: string | null

    @Column({ type: 'uuid', nullable: true })
    updatedBy?: string | null
}
