import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('should expose user identity and active tenant from JWT claims', async () => {
    const strategy = new JwtStrategy();

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'test@example.com',
      platformRole: 'admin',
      activeTenantId: 'tenant-1',
      memberRole: 'owner',
    });

    expect(result).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@example.com',
      platformRole: 'admin',
      memberRole: 'owner',
    });
  });
});
