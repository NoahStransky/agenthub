import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = process.env.AGENTHUB_DEV_PASSWORD || 'AgentHub123!';

const tenants = {
  platform: {
    name: 'AgentHub Platform',
    slug: 'agenthub-platform',
    tier: 'enterprise',
  },
  acme: {
    name: 'Acme Labs',
    slug: 'acme-labs',
    tier: 'pro',
  },
  demo: {
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    tier: 'free',
  },
};

const accounts = [
  {
    email: 'superadmin@agenthub.test',
    name: 'Super Admin',
    platformRole: 'super_admin',
    tenant: 'platform',
    memberRole: 'owner',
  },
  {
    email: 'admin@agenthub.test',
    name: 'Platform Admin',
    platformRole: 'admin',
    tenant: 'platform',
    memberRole: 'admin',
  },
  {
    email: 'owner@acme.test',
    name: 'Acme Owner',
    platformRole: 'user',
    tenant: 'acme',
    memberRole: 'owner',
  },
  {
    email: 'member@acme.test',
    name: 'Acme Member',
    platformRole: 'user',
    tenant: 'acme',
    memberRole: 'member',
  },
  {
    email: 'free@demo.test',
    name: 'Free Demo User',
    platformRole: 'user',
    tenant: 'demo',
    memberRole: 'owner',
  },
];

async function upsertCredentialAccount(userId, password) {
  const now = new Date();
  const passwordHash = await hashPassword(password);
  const existingAccount = await prisma.account.findFirst({
    where: {
      userId,
      providerId: 'credential',
    },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accountId: userId,
        password: passwordHash,
        updatedAt: now,
      },
    });
    return;
  }

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function main() {
  const legacyPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const tenantByKey = {};

  for (const [key, tenant] of Object.entries(tenants)) {
    tenantByKey[key] = await prisma.tenant.upsert({
      where: { slug: tenant.slug },
      update: {
        name: tenant.name,
        tier: tenant.tier,
        status: 'active',
        isActive: true,
      },
      create: {
        name: tenant.name,
        slug: tenant.slug,
        tier: tenant.tier,
        status: 'active',
        isActive: true,
      },
    });
  }

  for (const account of accounts) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        password: legacyPasswordHash,
        emailVerified: true,
        platformRole: account.platformRole,
        isActive: true,
        banned: false,
        banReason: null,
        banExpires: null,
      },
      create: {
        email: account.email,
        password: legacyPasswordHash,
        name: account.name,
        emailVerified: true,
        platformRole: account.platformRole,
        isActive: true,
        banned: false,
      },
    });

    await upsertCredentialAccount(user.id, DEFAULT_PASSWORD);

    const tenant = tenantByKey[account.tenant];
    await prisma.member.upsert({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: tenant.id,
        },
      },
      update: {
        role: account.memberRole,
      },
      create: {
        userId: user.id,
        tenantId: tenant.id,
        role: account.memberRole,
      },
    });
  }

  console.table(accounts.map((account) => ({
    email: account.email,
    password: DEFAULT_PASSWORD,
    platformRole: account.platformRole,
    workspace: tenants[account.tenant].name,
    memberRole: account.memberRole,
  })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
