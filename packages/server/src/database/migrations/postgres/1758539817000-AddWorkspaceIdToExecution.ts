import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceIdToExecution1758539817000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('execution', 'workspaceId')
        if (!hasColumn) {
            await queryRunner.query(`ALTER TABLE "execution" ADD COLUMN "workspaceId" text;`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('execution', 'workspaceId')
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE "execution" DROP COLUMN "workspaceId";`)
        }
    }
}
