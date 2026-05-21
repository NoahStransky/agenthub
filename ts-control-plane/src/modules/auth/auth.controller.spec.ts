import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  me: jest.fn(),
  issueApiTokenFromBetterAuthRequest: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto = { email: 'test@example.com', password: 'password123', name: 'Test' };
      mockAuthService.register.mockResolvedValue({ id: '1', email: dto.email });

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: '1', email: dto.email });
    });
  });

  describe('login', () => {
    it('should call authService.login', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      mockAuthService.login.mockResolvedValue({ access_token: 'jwt-token' });

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ access_token: 'jwt-token' });
    });
  });

  describe('me', () => {
    it('should call authService.me with user and active tenant from auth context', async () => {
      mockAuthService.me.mockResolvedValue({ user: { id: 'user-1' } });

      const result = await controller.me({ user: { userId: 'user-1', tenantId: 'tenant-1' } } as any);

      expect(mockAuthService.me).toHaveBeenCalledWith('user-1', 'tenant-1');
      expect(result).toEqual({ user: { id: 'user-1' } });
    });
  });

  describe('apiToken', () => {
    it('should issue an API token from Better Auth request cookies', async () => {
      const req = { headers: { cookie: 'better-auth.session_token=signed-token' } } as any;
      mockAuthService.issueApiTokenFromBetterAuthRequest.mockResolvedValue({ access_token: 'jwt-token' });

      const result = await controller.apiToken(req);

      expect(service.issueApiTokenFromBetterAuthRequest).toHaveBeenCalledWith(req);
      expect(result).toEqual({ access_token: 'jwt-token' });
    });
  });
});
