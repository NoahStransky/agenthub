CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT,
  "name" TEXT,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "platform_role" TEXT NOT NULL DEFAULT 'user',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "banned" BOOLEAN NOT NULL DEFAULT false,
  "ban_reason" TEXT,
  "ban_expires" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "tenants" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logo" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "tier" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'active',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE "members" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "members_user_id_tenant_id_key" ON "members"("user_id", "tenant_id");
CREATE INDEX "members_tenant_id_idx" ON "members"("tenant_id");

CREATE TABLE "invitations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "team_id" TEXT,
  "inviter_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invitations_tenant_id_idx" ON "invitations"("tenant_id");
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

CREATE TABLE "session" (
  "id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL,
  "active_organization_id" TEXT,
  "impersonated_by" TEXT,
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

CREATE TABLE "account" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP(3),
  "refresh_token_expires_at" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3),
  CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_configs" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

CREATE TABLE "llm_provider_configs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "base_url" TEXT NOT NULL,
  "api_key_enc" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "llm_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_provider_configs_tenant_id_idx" ON "llm_provider_configs"("tenant_id");

CREATE TABLE "instances" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_id" TEXT,
  "container_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "runtime_type" TEXT NOT NULL DEFAULT 'docker',
  "runtime_class" TEXT NOT NULL DEFAULT 'runc',
  "desired_status" TEXT NOT NULL DEFAULT 'running',
  "observed_status" TEXT NOT NULL DEFAULT 'pending',
  "health" TEXT NOT NULL DEFAULT 'unknown',
  "node_id" TEXT,
  "cluster_id" TEXT,
  "k8s_namespace" TEXT,
  "runtime_resource_name" TEXT,
  "cpu_request_millicores" INTEGER,
  "cpu_limit_millicores" INTEGER,
  "memory_request_bytes" BIGINT,
  "memory_limit_bytes" BIGINT,
  "failure_reason" TEXT,
  "endpoint" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "config" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "instance_id" TEXT,
  "project_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "agents" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "result" JSONB,
  "logs" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "members" ADD CONSTRAINT "members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "llm_provider_configs" ADD CONSTRAINT "llm_provider_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "instances" ADD CONSTRAINT "instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
