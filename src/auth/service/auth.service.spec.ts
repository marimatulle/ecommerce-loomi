import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('fake-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@email.com',
        name: 'Test',
        role: 'CLIENT',
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      const result = await service.register({
        email: 'test@email.com',
        password: '12345678',
        name: 'Test',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@email.com',
          password: 'hashedPassword',
        }),
      });
      expect(result).toEqual({
        id: 1,
        email: 'test@email.com',
        name: 'Test',
        role: 'CLIENT',
      });
    });

    it('should throw if user already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'existing@email.com',
      });

      await expect(
        service.register({
          email: 'existing@email.com',
          password: '12345678',
          name: 'Existing',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should login successfully and return JWT', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@email.com',
        password: 'hashed',
        name: 'Test',
        role: 'CLIENT',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@email.com',
        password: '12345678',
      });

      expect(jwt.signAsync).toHaveBeenCalled();
      expect(result).toEqual({ accessToken: 'fake-jwt-token' });
    });

    it('should throw for invalid email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'notfound@email.com', password: '12345678' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for invalid password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@email.com',
        password: 'hashed',
        name: 'Test',
        role: 'CLIENT',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@email.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
