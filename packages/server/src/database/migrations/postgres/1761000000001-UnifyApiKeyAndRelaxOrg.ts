import { MigrationInterface, QueryRunner } from 'typeorm'

export class UnifyApiKeyAndRelaxOrg1761000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add createdDate to apikey if missing
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'apikey' AND column_name = 'createdDate'
                ) THEN
                    ALTER TABLE apikey ADD COLUMN "createdDate" timestamp NOT NULL DEFAULT now();
                END IF;
            END$$;
        `)

        // Copy rows from legacy api_key table into apikey, avoiding duplicates by apiKey value
        await queryRunner.query(`
            INSERT INTO apikey ("id", "apiKey", "apiSecret", "keyName", "updatedDate", "workspaceId", "createdDate")
            SELECT
                COALESCE(NULLIF(ak."id", '')::uuid, uuid_generate_v4()),
                ak."apiKey",
                ak."apiSecret",
                ak."keyName",
                COALESCE(ak."updatedDate", ak."createdDate", now()),
                CASE WHEN ak."workspaceId" ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN ak."workspaceId"::uuid ELSE NULL END,
                COALESCE(ak."createdDate", now())
            FROM api_key ak
            WHERE NOT EXISTS (
                SELECT 1 FROM apikey a WHERE a."apiKey" = ak."apiKey"
            );
        `)

        // Drop legacy api_key table
        await queryRunner.query(`DROP TABLE IF EXISTS api_key;`)

        // Relax organizationId on workspace
        await queryRunner.query(`ALTER TABLE workspace ALTER COLUMN "organizationId" DROP NOT NULL;`)

        // Allow nullable audit columns in org/workspace mappings
        await queryRunner.query(`ALTER TABLE workspace_user ALTER COLUMN "createdBy" DROP NOT NULL;`)
        await queryRunner.query(`ALTER TABLE workspace_user ALTER COLUMN "updatedBy" DROP NOT NULL;`)
        await queryRunner.query(`ALTER TABLE organization_user ALTER COLUMN "createdBy" DROP NOT NULL;`)
        await queryRunner.query(`ALTER TABLE organization_user ALTER COLUMN "updatedBy" DROP NOT NULL;`)

        // Ensure role.organizationId is nullable (no-op if already)
        await queryRunner.query(`ALTER TABLE role ALTER COLUMN "organizationId" DROP NOT NULL;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Cannot recreate api_key without losing data; leave apikey unified.
        // Re-tightening NOT NULL constraints could break data; skip in down.
    }
}
