import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import { Workspace } from '../../oss/database/entities/workspace.entity'

@Entity({ name: 'product_brands' })
@Index(['name', 'workspaceId'], { unique: true })
@Index(['workspaceId'])
export class ProductBrand {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'uuid' })
    workspaceId: string

    @Column({ type: 'varchar', length: 100 })
    name: string

    @Column({ type: 'text', nullable: true })
    description: string

    @Column({ type: 'varchar', length: 255, nullable: true })
    logo_url: string

    @CreateDateColumn()
    createdDate: Date

    @UpdateDateColumn()
    updatedDate: Date

    @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspaceId' })
    workspace: Workspace
}