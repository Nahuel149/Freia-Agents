import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentAnalyticsEntities1757800000003 implements MigrationInterface {
    name = 'AddAgentAnalyticsEntities1757800000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS agent_event (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                type varchar NOT NULL,
                ts timestamp NOT NULL DEFAULT now(),
                "agentId" varchar,
                "clientId" varchar,
                "clientName" varchar,
                message text,
                "productId" varchar,
                qty integer,
                amount numeric,
                metadata text,
                CONSTRAINT "PK_agent_event_id" PRIMARY KEY (id)
            );
        `)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_event_ts ON agent_event (ts)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_event_type ON agent_event (type)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_event_client ON agent_event ("clientId")`)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS sale_record (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                ts timestamp NOT NULL DEFAULT now(),
                "agentId" varchar,
                "clientId" varchar,
                "clientName" varchar,
                "totalAmount" numeric NOT NULL DEFAULT 0,
                items text,
                CONSTRAINT "PK_sale_record_id" PRIMARY KEY (id)
            );
        `)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sale_record_ts ON sale_record (ts)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sale_record_client ON sale_record ("clientId")`)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS product_inventory (
                "productId" varchar NOT NULL,
                name varchar,
                brand varchar,
                stock integer NOT NULL DEFAULT 0,
                price numeric,
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_inventory_id" PRIMARY KEY ("productId")
            );
        `)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS client_account (
                "clientId" varchar NOT NULL,
                name varchar,
                company varchar,
                email varchar,
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_client_account_id" PRIMARY KEY ("clientId")
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS client_account`)
        await queryRunner.query(`DROP TABLE IF EXISTS product_inventory`)
        await queryRunner.query(`DROP TABLE IF EXISTS sale_record`)
        await queryRunner.query(`DROP TABLE IF EXISTS agent_event`)
    }
}
