import { PrismaService } from '@core/database/prisma.service';

type DynamicImport = <T = any>(specifier: string) => Promise<T>;

const dynamicImport = new Function('specifier', 'return import(specifier)') as DynamicImport;

export async function createAgentHubBetterAuth(prisma: PrismaService) {
  const [
    { betterAuth },
    { prismaAdapter },
    { admin, organization, createAccessControl },
  ] = await Promise.all([
    dynamicImport('better-auth'),
    dynamicImport('@better-auth/prisma-adapter'),
    dynamicImport('better-auth/plugins'),
  ]);

  const adminAccessControl = createAccessControl({
    user: ['create', 'list', 'set-role', 'ban', 'impersonate', 'impersonate-admins', 'delete', 'set-password', 'get', 'update'],
    session: ['list', 'revoke', 'delete'],
  });
  const userRole = adminAccessControl.newRole({ user: [], session: [] });
  const adminRole = adminAccessControl.newRole({
    user: ['create', 'list', 'set-role', 'ban', 'impersonate', 'delete', 'set-password', 'get', 'update'],
    session: ['list', 'revoke', 'delete'],
  });
  const superAdminRole = adminAccessControl.newRole({
    user: ['create', 'list', 'set-role', 'ban', 'impersonate', 'impersonate-admins', 'delete', 'set-password', 'get', 'update'],
    session: ['list', 'revoke', 'delete'],
  });

  const trustedOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);

  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'change-me',
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    basePath: process.env.BETTER_AUTH_BASE_PATH || '/auth',
    ...(trustedOrigins?.length ? { trustedOrigins } : {}),
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    databaseHooks: {
      user: {
        create: {
          before: async (user: Record<string, unknown>) => {
            const existingUsers = await prisma.user.count();
            return {
              data: {
                ...user,
                platformRole: existingUsers === 0 ? 'super_admin' : 'user',
                isActive: true,
              },
            };
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        platformRole: {
          type: 'string',
          required: false,
          defaultValue: 'user',
          input: false,
        },
      },
    },
    session: {
      additionalFields: {
        activeOrganizationId: {
          type: 'string',
          required: false,
        },
      },
    },
    plugins: [
      admin({
        defaultRole: 'user',
        adminRoles: ['admin', 'super_admin'],
        ac: adminAccessControl,
        roles: {
          user: userRole,
          admin: adminRole,
          super_admin: superAdminRole,
        },
        schema: {
          user: {
            fields: {
              role: 'platformRole',
            },
          },
        },
      }),
      organization({
        allowUserToCreateOrganization: true,
        schema: {
          organization: {
            modelName: 'tenant',
          },
          member: {
            modelName: 'member',
            fields: {
              organizationId: 'tenantId',
            },
          },
          invitation: {
            modelName: 'invitation',
            fields: {
              organizationId: 'tenantId',
            },
          },
        },
      }),
    ],
  });
}
