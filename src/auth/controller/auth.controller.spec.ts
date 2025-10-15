import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../service/auth.service';
import { AuthGuard } from '../auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should register user', async () => {
    const dto = { email: 'test@email.com', password: '12345678', name: 'Test' };
    const result = { id: 1, email: dto.email, name: dto.name, role: 'CLIENT' };

    (service.register as jest.Mock).mockResolvedValue(result);

    expect(await controller.register(dto)).toEqual(result);
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('should login user', async () => {
    const dto = { email: 'test@email.com', password: '12345678' };
    const result = { accessToken: 'jwt' };

    (service.login as jest.Mock).mockResolvedValue(result);

    expect(await controller.login(dto)).toEqual(result);
    expect(service.login).toHaveBeenCalledWith(dto);
  });

  it('should return logged user from request', async () => {
    const req = { user: { id: 1, email: 'test@email.com' } };
    const result = await controller.loggedUser(req);

    expect(result).toEqual(req.user);
  });
});
