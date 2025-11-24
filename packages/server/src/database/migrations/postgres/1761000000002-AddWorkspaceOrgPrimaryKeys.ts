import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceOrgPrimaryKeys1761000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop any existing PK to avoid duplicate-PK errors, then add composite PK to workspace_user
        await queryRunner.query(`
            DO $$
            DECLARE
                pk_name text;
            BEGIN
                /* Drop existing primary key (if any) */
                SELECT constraint_name
                INTO pk_name
                FROM information_schema.table_constraints
                WHERE table_name = 'workspace_user'
                  AND constraint_type = 'PRIMARY KEY';

                IF pk_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE workspace_user DROP CONSTRAINT %I', pk_name);
                END IF;

                /* Create composite primary key if it does not exist */
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints tc
                    WHERE tc.table_name = 'workspace_user'
                      AND tc.constraint_type = 'PRIMARY KEY'
                ) THEN
                    ALTER TABLE workspace_user ADD CONSTRAINT workspace_user_pkey PRIMARY KEY ("workspaceId", "userId");
                END IF;
            END$$;
        `)

        // Drop any existing PK para evitar errores de PK duplicada y luego añade PK compuesta a organization_user
        await queryRunner.query(`
            DO $$
            DECLARE
                pk_name text;
            BEGIN
                /* Drop existing primary key (if any) */
                SELECT constraint_name
                INTO pk_name
                FROM information_schema.table_constraints
                WHERE table_name = 'organization_user'
                  AND constraint_type = 'PRIMARY KEY';

                IF pk_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE organization_user DROP CONSTRAINT %I', pk_name);
                END IF;

                /* Create composite primary key if it does not exist */
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints tc
                    WHERE tc.table_name = 'organization_user'
                      AND tc.constraint_type = 'PRIMARY KEY'
                ) THEN
                    ALTER TABLE organization_user ADD CONSTRAINT organization_user_pkey PRIMARY KEY ("organizationId", "userId");
                END IF;
            END$$;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE workspace_user DROP CONSTRAINT IF EXISTS workspace_user_pkey;`)
        await queryRunner.query(`ALTER TABLE organization_user DROP CONSTRAINT IF EXISTS organization_user_pkey;`)
    }
}
