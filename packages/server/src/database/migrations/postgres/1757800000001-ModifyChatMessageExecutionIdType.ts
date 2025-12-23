import { MigrationInterface, QueryRunner } from 'typeorm'

export class ModifyChatMessageExecutionIdType1757800000001 implements MigrationInterface {
    name = 'ModifyChatMessageExecutionIdType1757800000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure chat_message.executionId is uuid to match Execution.id type
        const hasColumn = await queryRunner.hasColumn('chat_message', 'executionId')
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE "chat_message" ALTER COLUMN "executionId" TYPE uuid USING NULLIF("executionId", '')::uuid`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('chat_message', 'executionId')
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE "chat_message" ALTER COLUMN "executionId" TYPE varchar USING "executionId"::varchar`)
        }
    }
}
