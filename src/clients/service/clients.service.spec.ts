import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateClientDto } from '../dtos/create-client.dto';
import { UpdateClientDto } from '../dtos/update-client.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

describe('ClientsService', () => {
  let service: ClientsService;

  const mockPrisma = {
    client: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const adminUser: AuthenticatedUser = {
    id: 99,
    email: 'admin@test.com',
    role: 'ADMIN',
  };

  const clientUser: AuthenticatedUser = {
    id: 2,
    email: 'client@test.com',
    role: 'USER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      mockPrisma.client.create.mockResolvedValue({
        id: 1,
        fullName: 'Test',
        userId: 1,
      });

      const dto: CreateClientDto = {
        fullName: 'Test',
        contact: '123',
        address: 'Addr',
      };
      const result = await service.create(1, dto);

      expect(result).toEqual({ id: 1, fullName: 'Test', userId: 1 });
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: { ...dto, userId: 1 },
      });
    });

    it('should throw if client already exists', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 1 });

      const dto: CreateClientDto = {
        fullName: 'Test',
        contact: '123',
        address: 'Addr',
      };
      await expect(service.create(1, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all clients', async () => {
      const clients = [
        { id: 1, fullName: 'Test', user: { email: 'a@a.com', role: 'USER' } },
      ];
      mockPrisma.client.findMany.mockResolvedValue(clients);

      const result = await service.findAll();
      expect(result).toEqual(clients);
    });
  });

  describe('findOne', () => {
    it('should return client for admin', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      const result = await service.findOne(1, adminUser);
      expect(result).toEqual(client);
    });

    it('should return client for owner', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      const result = await service.findOne(1, clientUser);
      expect(result).toEqual(client);
    });

    it('should throw if not owner and not admin', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      const otherUser: AuthenticatedUser = {
        id: 3,
        email: 'other@test.com',
        role: 'USER',
      };

      await expect(service.findOne(1, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if client not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(service.findOne(1, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update client for admin', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.client.update.mockResolvedValue({
        ...client,
        fullName: 'Updated',
        status: false,
      });

      const dto: UpdateClientDto = { fullName: 'Updated', status: false };
      const result = await service.update(1, dto, adminUser);

      expect(result.fullName).toBe('Updated');
      expect(result.status).toBe(false);
    });

    it('should remove status for non-admin', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.client.update.mockResolvedValue({
        ...client,
        fullName: 'Updated',
      });

      const dto: UpdateClientDto = { fullName: 'Updated', status: false };
      const result = await service.update(1, dto, clientUser);

      expect(result.fullName).toBe('Updated');
      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { fullName: 'Updated' },
      });
    });

    it('should throw if not owner and not admin', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      const dto: UpdateClientDto = { fullName: 'Updated' };

      const otherUser: AuthenticatedUser = {
        id: 3,
        email: 'other@test.com',
        role: 'USER',
      };

      await expect(service.update(1, dto, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if client not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      const dto: UpdateClientDto = { fullName: 'Updated' };

      await expect(service.update(1, dto, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove client', async () => {
      const client = { id: 1 };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.client.delete.mockResolvedValue(client);

      const result = await service.remove(1);
      expect(result).toEqual(client);
    });

    it('should throw if client not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });
  });
});
