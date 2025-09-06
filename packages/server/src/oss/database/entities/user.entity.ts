import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Simplified User entity for open-source mode. Only includes properties accessed by OSS code paths
 * such as credential hashing and basic profile details.
 */
@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100 })
    name!: string

    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string

    // Hashed password / credential string stored as text
    @Column({ type: 'text', nullable: true })
    credential?: string | null

    // Optional personal workspace reference (nullable in OSS)
    @Column({ type: 'uuid', nullable: true })
    activeWorkspaceId?: string | null

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date
}