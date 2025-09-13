import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCodeAgentEntities1755066758602 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create CodeAgent table
        await queryRunner.query(`
            CREATE TABLE "code_agent" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar NOT NULL,
                "description" text,
                "code" text NOT NULL,
                "language" varchar(20) NOT NULL DEFAULT 'javascript',
                "isPublic" boolean,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                "workspaceId" text
            )
        `)

        // Create CodeAgentExecution table
        await queryRunner.query(`
            CREATE TABLE "code_agent_execution" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "codeAgentId" varchar NOT NULL,
                "input" text,
                "output" text,
                "error" text,
                "chatHistory" text,
                "status" varchar(20) NOT NULL DEFAULT 'running',
                "startTime" timestamp NOT NULL DEFAULT now(),
                "endTime" timestamp,
                "workspaceId" text
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "code_agent_execution"`)
        await queryRunner.query(`DROP TABLE "code_agent"`)
    }
}