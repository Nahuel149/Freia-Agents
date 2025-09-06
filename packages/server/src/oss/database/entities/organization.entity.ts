import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Simplified Organization entity for OSS mode. Omits billing/subscription metadata.
 */
export enum OrganizationName {
    DEFAULT_ORGANIZATION = 'Default Organization',
}

@Entity()
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100, default: OrganizationName.DEFAULT_ORGANIZATION })
    name!: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ type: 'uuid', nullable: true })
    createdBy?: string | null

    @Column({ type: 'uuid', nullable: true })
    updatedBy?: string | null

    // Billing customer reference used by Stripe integration in some OSS paths
    @Column({ type: 'text', nullable: true })
    customerId?: string | null

    @Column({ type: 'text', nullable: true })
    subscriptionId?: string | null
}