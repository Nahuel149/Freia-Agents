import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { IUserTemplate } from '../../Interface'
import { LandingTemplate } from './LandingTemplate'

@Entity({ name: 'user_templates' })
export class UserTemplate implements IUserTemplate {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ name: 'user_id', type: 'varchar', nullable: true })
    userId?: string | null

    @Column({ name: 'template_id', type: 'uuid' })
    templateId: string

    @Column({ name: 'workspace_id', type: 'varchar', nullable: true })
    workspaceId?: string | null

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date

    @ManyToOne(() => LandingTemplate, (template) => template.assignments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'template_id' })
    template: LandingTemplate
}
