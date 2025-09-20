import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import { Workspace } from '../../oss/database/entities/workspace.entity'
import { ProductCategory } from './ProductCategory'
import { ProductBrand } from './ProductBrand'

@Entity({ name: 'products' })
@Index(['productId', 'workspaceId'], { unique: true })
@Index(['workspaceId'])
@Index(['categoryId'])
@Index(['brandId'])
@Index(['precio'])
@Index(['stock'])
@Index(['nombre'])
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar' })
    productId: string

    @Column({ type: 'uuid' })
    workspaceId: string

    @Column({ type: 'uuid', nullable: true })
    categoryId: string

    @Column({ type: 'uuid', nullable: true })
    brandId: string

    @Column({ type: 'varchar', length: 255 })
    nombre: string

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    precio: number

    @Column({ type: 'integer', default: 0 })
    stock: number

    @Column({ type: 'text', nullable: true })
    descripcion: string

    @Column({ type: 'jsonb', nullable: true })
    especificaciones: any

    @Column({ type: 'varchar', length: 50, nullable: true })
    sku: string

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    costo: number

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    margen: number

    @Column({ type: 'integer', default: 0 })
    stockMinimo: number

    @Column({ type: 'varchar', length: 100, nullable: true })
    unidadMedida: string

    @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
    peso: number

    @Column({ type: 'jsonb', nullable: true })
    dimensiones: any

    @Column({ type: 'text', array: true, nullable: true })
    imagenes: string[]

    @Column({ type: 'boolean', default: true })
    activo: boolean

    @Column({ type: 'boolean', default: false })
    destacado: boolean

    @Column({ type: 'text', array: true, nullable: true })
    tags: string[]

    @CreateDateColumn()
    createdDate: Date

    @UpdateDateColumn()
    updatedDate: Date

    @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspaceId' })
    workspace: Workspace

    @ManyToOne(() => ProductCategory, { nullable: true })
    @JoinColumn({ name: 'categoryId' })
    category: ProductCategory

    @ManyToOne(() => ProductBrand, { nullable: true })
    @JoinColumn({ name: 'brandId' })
    brand: ProductBrand
}