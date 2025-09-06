import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

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
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'text' })
    organizationId!: string

    @Column({ type: 'text' })
    userId!: string

    @Column({ type: 'text', nullable: true })
    roleId?: string | null

    @Column({ type: 'enum', enum: OrganizationUserStatus, default: OrganizationUserStatus.INVITED })
    status!: OrganizationUserStatus

    @UpdateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date
}
