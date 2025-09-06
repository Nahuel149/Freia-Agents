-- PostgreSQL Database Setup for Flowise Application
-- This script creates all necessary tables for user management and application functionality

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CORE APPLICATION TABLES
-- =============================================

-- Chat Flow table
CREATE TABLE IF NOT EXISTS "chat_flow" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "flowData" text,
    "deployed" boolean,
    "isPublic" boolean,
    "apikeyid" varchar,
    "chatbotConfig" text,
    "apiConfig" text,
    "analytic" text,
    "speechToText" text,
    "followUpPrompts" text,
    "category" varchar,
    "type" varchar,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "workspaceId" varchar,
    CONSTRAINT "PK_chat_flow" PRIMARY KEY ("id")
);

-- Chat Message table
CREATE TABLE IF NOT EXISTS "chat_message" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "role" varchar NOT NULL,
    "chatflowid" varchar NOT NULL,
    "executionId" varchar,
    "content" text,
    "sourceDocuments" text,
    "usedTools" text,
    "fileAnnotations" text,
    "agentReasoning" text,
    "fileUploads" text,
    "artifacts" text,
    "action" text,
    "chatType" varchar,
    "chatId" varchar,
    "memoryType" varchar,
    "sessionId" varchar,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "leadEmail" varchar,
    "followUpPrompts" text,
    CONSTRAINT "PK_chat_message" PRIMARY KEY ("id")
);

-- Create index on chatflowid for better performance
CREATE INDEX IF NOT EXISTS "IDX_chat_message_chatflowid" ON "chat_message" ("chatflowid");

-- Credential table
CREATE TABLE IF NOT EXISTS "credential" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "credentialName" varchar NOT NULL,
    "encryptedData" text,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "workspaceId" varchar,
    CONSTRAINT "PK_credential" PRIMARY KEY ("id")
);

-- Tool table
CREATE TABLE IF NOT EXISTS "tool" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "description" text,
    "color" varchar,
    "iconSrc" varchar,
    "schema" text,
    "func" text,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "workspaceId" varchar,
    CONSTRAINT "PK_tool" PRIMARY KEY ("id")
);

-- API Key table
CREATE TABLE IF NOT EXISTS "api_key" (
    "id" varchar NOT NULL,
    "apiKey" varchar NOT NULL,
    "apiSecret" varchar NOT NULL,
    "keyName" varchar NOT NULL,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "workspaceId" varchar,
    CONSTRAINT "PK_api_key" PRIMARY KEY ("id")
);

-- Assistant table
CREATE TABLE IF NOT EXISTS "assistant" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "credential" varchar NOT NULL,
    "details" text NOT NULL,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "workspaceId" varchar,
    CONSTRAINT "PK_assistant" PRIMARY KEY ("id")
);

-- =============================================
-- ENTERPRISE USER MANAGEMENT TABLES
-- =============================================

-- User table (main user entity)
CREATE TABLE IF NOT EXISTS "user" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(100) NOT NULL,
    "email" varchar(255) NOT NULL UNIQUE,
    "credential" text,
    "tempToken" text,
    "tokenExpiry" timestamp,
    "status" varchar(20) NOT NULL DEFAULT 'UNVERIFIED',
    "activeWorkspaceId" uuid,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "createdBy" uuid,
    "updatedBy" uuid,
    CONSTRAINT "PK_user" PRIMARY KEY ("id")
);

-- Organization table
CREATE TABLE IF NOT EXISTS "organization" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(100) NOT NULL DEFAULT 'Default Organization',
    "customerId" varchar(100),
    "subscriptionId" varchar(100),
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "createdBy" uuid,
    "updatedBy" uuid,
    CONSTRAINT "PK_organization" PRIMARY KEY ("id")
);

-- Role table
CREATE TABLE IF NOT EXISTS "role" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "organizationId" uuid,
    "name" varchar(100) NOT NULL,
    "description" text,
    "permissions" text NOT NULL,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "createdBy" uuid,
    "updatedBy" uuid,
    CONSTRAINT "PK_role" PRIMARY KEY ("id")
);

-- Login Method table
CREATE TABLE IF NOT EXISTS "login_method" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "organizationId" uuid,
    "name" varchar(100) NOT NULL,
    "config" text NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'ENABLE',
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "createdBy" uuid,
    "updatedBy" uuid,
    CONSTRAINT "PK_login_method" PRIMARY KEY ("id")
);

-- Organization User table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS "organization_user" (
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "roleId" uuid NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "createdBy" uuid NOT NULL,
    "updatedBy" uuid NOT NULL,
    CONSTRAINT "PK_organization_user" PRIMARY KEY ("organizationId", "userId")
);

-- Workspace table
CREATE TABLE IF NOT EXISTS "workspace" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(100) NOT NULL DEFAULT 'Default Workspace',
    "description" text,
    "organizationId" uuid NOT NULL,
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "createdBy" uuid,
    "updatedBy" uuid,
    CONSTRAINT "PK_workspace" PRIMARY KEY ("id")
);

-- Workspace User table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS "workspace_user" (
    "workspaceId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "roleId" uuid NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
    "createdDate" timestamp NOT NULL DEFAULT now(),
    "updatedDate" timestamp NOT NULL DEFAULT now(),
    "createdBy" uuid NOT NULL,
    "updatedBy" uuid NOT NULL,
    CONSTRAINT "PK_workspace_user" PRIMARY KEY ("workspaceId", "userId")
);

-- Login Activity table (for audit logging)
CREATE TABLE IF NOT EXISTS "login_activity" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "username" varchar NOT NULL,
    "activity_code" integer NOT NULL,
    "message" varchar NOT NULL,
    "attemptedDateTime" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "PK_login_activity" PRIMARY KEY ("id")
);

-- =============================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================

-- User table foreign keys
ALTER TABLE "user" 
ADD CONSTRAINT "FK_user_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
ADD CONSTRAINT "FK_user_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;

-- Organization table foreign keys
ALTER TABLE "organization" 
ADD CONSTRAINT "FK_organization_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
ADD CONSTRAINT "FK_organization_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;

-- User table foreign keys
ALTER TABLE "user" 
ADD CONSTRAINT "FK_user_activeWorkspaceId" FOREIGN KEY ("activeWorkspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL,
ADD CONSTRAINT "FK_user_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
ADD CONSTRAINT "FK_user_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;

-- Role table foreign keys
ALTER TABLE "role" 
ADD CONSTRAINT "FK_role_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_role_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
ADD CONSTRAINT "FK_role_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;

-- Login Method table foreign keys
ALTER TABLE "login_method" 
ADD CONSTRAINT "FK_login_method_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_login_method_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
ADD CONSTRAINT "FK_login_method_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;

-- Organization User table foreign keys
ALTER TABLE "organization_user" 
ADD CONSTRAINT "FK_organization_user_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_organization_user_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_organization_user_roleId" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_organization_user_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_organization_user_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE CASCADE;

-- Workspace table foreign keys
ALTER TABLE "workspace" 
ADD CONSTRAINT "FK_workspace_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_workspace_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
ADD CONSTRAINT "FK_workspace_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;

-- Workspace User table foreign keys
ALTER TABLE "workspace_user" 
ADD CONSTRAINT "FK_workspace_user_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_workspace_user_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_workspace_user_roleId" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_workspace_user_createdBy" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE,
ADD CONSTRAINT "FK_workspace_user_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE CASCADE;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS "IDX_user_email" ON "user" ("email");
CREATE INDEX IF NOT EXISTS "IDX_user_status" ON "user" ("status");
CREATE INDEX IF NOT EXISTS "IDX_user_activeWorkspaceId" ON "user" ("activeWorkspaceId");
CREATE INDEX IF NOT EXISTS "IDX_organization_user_userId" ON "organization_user" ("userId");
CREATE INDEX IF NOT EXISTS "IDX_organization_user_organizationId" ON "organization_user" ("organizationId");
CREATE INDEX IF NOT EXISTS "IDX_workspace_user_userId" ON "workspace_user" ("userId");
CREATE INDEX IF NOT EXISTS "IDX_workspace_user_workspaceId" ON "workspace_user" ("workspaceId");
CREATE INDEX IF NOT EXISTS "IDX_workspace_organizationId" ON "workspace" ("organizationId");
CREATE INDEX IF NOT EXISTS "IDX_role_organizationId" ON "role" ("organizationId");
CREATE INDEX IF NOT EXISTS "IDX_login_method_organizationId" ON "login_method" ("organizationId");

-- =============================================
-- INITIAL DATA SETUP
-- =============================================

-- Insert default admin user (you'll need to update the password hash)
INSERT INTO "user" ("id", "name", "email", "status", "createdBy", "updatedBy") 
VALUES (
    uuid_generate_v4(),
    'Admin User',
    'admin@yourdomain.com',
    'ACTIVE',
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1)
) ON CONFLICT ("email") DO NOTHING;

-- Insert default organization
INSERT INTO "organization" ("id", "name", "createdBy", "updatedBy") 
VALUES (
    uuid_generate_v4(),
    'Default Organization',
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1)
) ON CONFLICT DO NOTHING;

-- Insert default admin role
INSERT INTO "role" ("id", "organizationId", "name", "description", "permissions", "createdBy", "updatedBy") 
VALUES (
    uuid_generate_v4(),
    (SELECT "id" FROM "organization" WHERE "name" = 'Default Organization' LIMIT 1),
    'Admin',
    'Administrator role with full permissions',
    '["read", "write", "delete", "admin"]',
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1)
) ON CONFLICT DO NOTHING;

-- Insert default workspace
INSERT INTO "workspace" ("id", "name", "description", "organizationId", "createdBy", "updatedBy") 
VALUES (
    uuid_generate_v4(),
    'Default Workspace',
    'Default workspace for the organization',
    (SELECT "id" FROM "organization" WHERE "name" = 'Default Organization' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1)
) ON CONFLICT DO NOTHING;

-- Link admin user to organization
INSERT INTO "organization_user" ("organizationId", "userId", "roleId", "createdBy", "updatedBy") 
VALUES (
    (SELECT "id" FROM "organization" WHERE "name" = 'Default Organization' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "role" WHERE "name" = 'Admin' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1)
) ON CONFLICT DO NOTHING;

-- Link admin user to workspace
INSERT INTO "workspace_user" ("workspaceId", "userId", "roleId", "createdBy", "updatedBy") 
VALUES (
    (SELECT "id" FROM "workspace" WHERE "name" = 'Default Workspace' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "role" WHERE "name" = 'Admin' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1),
    (SELECT "id" FROM "user" WHERE "email" = 'admin@yourdomain.com' LIMIT 1)
) ON CONFLICT DO NOTHING;

-- Update admin user with activeWorkspaceId
UPDATE "user" 
SET "activeWorkspaceId" = (SELECT "id" FROM "workspace" WHERE "name" = 'Default Workspace' LIMIT 1)
WHERE "email" = 'admin@yourdomain.com';

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL database setup completed successfully!';
    RAISE NOTICE 'Tables created: user, organization, role, workspace, login_method, organization_user, workspace_user, login_activity';
    RAISE NOTICE 'Core application tables: chat_flow, chat_message, credential, tool, api_key, assistant';
    RAISE NOTICE 'Default admin user created with email: admin@yourdomain.com';
    RAISE NOTICE 'Please update the admin user password and email as needed.';
END $$;