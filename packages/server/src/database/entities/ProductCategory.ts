import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm'
import { Workspace } from './Workspace'

@Entity({ name: 'product_categories' })
@Index(['name', 'workspaceId'], { unique: true })
@Index(['workspaceId'])
export class ProductCategory {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'uuid' })
    workspaceId: string

    @Column({ type: 'varchar', length: 100 })
    name: string

    @Column({ type: 'text', nullable: true })
    description: string

    @Column({ type: 'uuid', nullable: true })
    parentCategoryId: string

    @CreateDateColumn()
    createdDate: Date

    @UpdateDateColumn()
    updatedDate: Date

    @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspaceId' })
    workspace: Workspace

    @ManyToOne(() => ProductCategory, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'parentCategoryId' })
    parentCategory: ProductCategory

    @OneToMany(() => ProductCategory, category => category.parentCategory)
    subCategories: ProductCategory[]
}