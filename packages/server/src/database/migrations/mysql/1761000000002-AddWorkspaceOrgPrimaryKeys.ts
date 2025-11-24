import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceOrgPrimaryKeys1761000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`workspace_user\` DROP PRIMARY KEY;
            ALTER TABLE \`workspace_user\`
            ADD PRIMARY KEY (\`workspaceId\`, \`userId\`);
        `)

        await queryRunner.query(`
            ALTER TABLE \`organization_user\` DROP PRIMARY KEY;
            ALTER TABLE \`organization_user\`
            ADD PRIMARY KEY (\`organizationId\`, \`userId\`);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`workspace_user\` DROP PRIMARY KEY;`)
        await queryRunner.query(`ALTER TABLE \`organization_user\` DROP PRIMARY KEY;`)
    }
}
