import { JwtStrategy, extractJwtFromCookie } from './jwt.strategy';

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

  it('should extract JWT from agenthub_token cookie for browser proxy navigation', () => {
    expect(extractJwtFromCookie({
      headers: {
        cookie: 'theme=light; agenthub_token=abc.def.ghi; other=value',
      },
    })).toBe('abc.def.ghi');
  });
});
