import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMultiTenantProductTables1758392900000 implements MigrationInterface {
    name = 'AddMultiTenantProductTables1758392900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add workspaceId to existing tables that don't have it
        await queryRunner.query(`
            ALTER TABLE customers 
            ADD COLUMN IF NOT EXISTS "workspaceId" uuid;
        `)
        
        await queryRunner.query(`
            ALTER TABLE sales 
            ADD COLUMN IF NOT EXISTS "workspaceId" uuid;
        `)
        
        await queryRunner.query(`
            ALTER TABLE follow_ups 
            ADD COLUMN IF NOT EXISTS "workspaceId" uuid;
        `)
        
        await queryRunner.query(`
            ALTER TABLE product_inventory 
            ADD COLUMN IF NOT EXISTS "workspaceId" uuid;
        `)

        // Create comprehensive products table for DATAFINALV1.0.json
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS products (
                id uuid DEFAULT uuid_generate_v4() NOT NULL,
                "productId" varchar NOT NULL,
                "workspaceId" uuid NOT NULL,
                categoria varchar(100),
                marca varchar(100),
                nombre varchar(255) NOT NULL,
                precio numeric(12,2),
                stock integer DEFAULT 0,
                descripcion text,
                especificaciones jsonb,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_products" PRIMARY KEY (id),
                CONSTRAINT "UQ_products_productId_workspace" UNIQUE ("productId", "workspaceId")
            );
        `)

        // Create categories table for better organization
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS product_categories (
                id uuid DEFAULT uuid_generate_v4() NOT NULL,
                "workspaceId" uuid NOT NULL,
                name varchar(100) NOT NULL,
                description text,
                "parentCategoryId" uuid,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_categories" PRIMARY KEY (id),
                CONSTRAINT "UQ_categories_name_workspace" UNIQUE (name, "workspaceId")
            );
        `)

        // Create brands table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS product_brands (
                id uuid DEFAULT uuid_generate_v4() NOT NULL,
                "workspaceId" uuid NOT NULL,
                name varchar(100) NOT NULL,
                description text,
                logo_url varchar(255),
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_brands" PRIMARY KEY (id),
                CONSTRAINT "UQ_brands_name_workspace" UNIQUE (name, "workspaceId")
            );
        `)

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE customers 
            ADD CONSTRAINT "FK_customers_workspaceId" 
            FOREIGN KEY ("workspaceId") REFERENCES workspace(id) ON DELETE CASCADE;
        `)
        
        await queryRunner.query(`
            ALTER TABLE sales 
            ADD CONSTRAINT "FK_sales_workspaceId" 
            FOREIGN KEY ("workspaceId") REFERENCES workspace(id) ON DELETE CASCADE;
        `)
        
        await queryRunner.query(`
            ALTER TABLE follow_ups 
            ADD CONSTRAINT "FK_follow_ups_workspaceId" 
            FOREIGN KEY ("workspaceId") REFERENCES workspace(id) ON DELETE CASCADE;
        `)
        
        await queryRunner.query(`
            ALTER TABLE product_inventory 
            ADD CONSTRAINT "FK_product_inventory_workspaceId" 
            FOREIGN KEY ("workspaceId") REFERENCES workspace(id) ON DELETE CASCADE;
        `)

        await queryRunner.query(`
            ALTER TABLE products 
            ADD CONSTRAINT "FK_products_workspaceId" 
            FOREIGN KEY ("workspaceId") REFERENCES workspace(id) ON DELETE CASCADE;
        `)

        await queryRunner.query(`
            ALTER TABLE product_categories 
            ADD CONSTRAINT "FK_product_categories_workspaceId" 
            FOREIGN KEY ("workspaceId") REFERENCES workspace(id) ON DELETE CASCADE;
        `)

        await queryRunner.query(`
            ALTER TABLE product_categories 
            ADD CONSTRAINT "FK_product_categories_parent" 
            FOREIGN KEY ("parentCategoryId") REFERENCES product_categories(id) ON DELETE SET NULL;
        `)

        await queryRunner.query(`
            ALTER TABLE product_brands 
            ADD CONSTRAINT "FK_product_brands_workspaceId" 
            FOREIGN KEY ("workspaceId") REFERENCES workspace(id) ON DELETE CASCADE;
        `)

        // Create indexes for performance
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_workspaceId" ON customers ("workspaceId");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_workspaceId" ON sales ("workspaceId");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_follow_ups_workspaceId" ON follow_ups ("workspaceId");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_inventory_workspaceId" ON product_inventory ("workspaceId");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_workspaceId" ON products ("workspaceId");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_categoria" ON products (categoria);`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_marca" ON products (marca);`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_precio" ON products (precio);`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_stock" ON products (stock);`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_categories_workspaceId" ON product_categories ("workspaceId");`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_brands_workspaceId" ON product_brands ("workspaceId");`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS "FK_customers_workspaceId";`)
        await queryRunner.query(`ALTER TABLE sales DROP CONSTRAINT IF EXISTS "FK_sales_workspaceId";`)
        await queryRunner.query(`ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS "FK_follow_ups_workspaceId";`)
        await queryRunner.query(`ALTER TABLE product_inventory DROP CONSTRAINT IF EXISTS "FK_product_inventory_workspaceId";`)
        await queryRunner.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS "FK_products_workspaceId";`)
        await queryRunner.query(`ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS "FK_product_categories_workspaceId";`)
        await queryRunner.query(`ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS "FK_product_categories_parent";`)
        await queryRunner.query(`ALTER TABLE product_brands DROP CONSTRAINT IF EXISTS "FK_product_brands_workspaceId";`)

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_workspaceId";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_workspaceId";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_follow_ups_workspaceId";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_inventory_workspaceId";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_workspaceId";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_categoria";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_marca";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_precio";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_stock";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_categories_workspaceId";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_brands_workspaceId";`)

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS product_brands;`)
        await queryRunner.query(`DROP TABLE IF EXISTS product_categories;`)
        await queryRunner.query(`DROP TABLE IF EXISTS products;`)

        // Remove workspaceId columns
        await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS "workspaceId";`)
        await queryRunner.query(`ALTER TABLE sales DROP COLUMN IF EXISTS "workspaceId";`)
        await queryRunner.query(`ALTER TABLE follow_ups DROP COLUMN IF EXISTS "workspaceId";`)
        await queryRunner.query(`ALTER TABLE product_inventory DROP COLUMN IF EXISTS "workspaceId";`)
    }
}