import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceOrgPrimaryKeys1761000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add composite PK to workspace_user
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    WHERE t.relname = 'workspace_user' AND c.conname = 'workspace_user_pkey'
                ) THEN
                    ALTER TABLE workspace_user ADD CONSTRAINT workspace_user_pkey PRIMARY KEY ("workspaceId", "userId");
                END IF;
            END$$;
        `)

        // Add composite PK to organization_user
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    WHERE t.relname = 'organization_user' AND c.conname = 'organization_user_pkey'
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
