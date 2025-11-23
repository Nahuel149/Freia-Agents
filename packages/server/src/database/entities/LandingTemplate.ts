import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { ILandingTemplate } from '../../Interface'
import { UserTemplate } from './UserTemplate'

@Entity({ name: 'landing_templates' })
export class LandingTemplate implements ILandingTemplate {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ unique: true })
    slug: string

    @Column()
    name: string

    @Column({ type: 'json' })
    config: Record<string, any>

    @Column({ name: 'owner_workspace_id', nullable: true, type: 'varchar' })
    ownerWorkspaceId?: string | null

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date

    @OneToMany(() => UserTemplate, (assignment) => assignment.template)
    assignments: UserTemplate[]
}
