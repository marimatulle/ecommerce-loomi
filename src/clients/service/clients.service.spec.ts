import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from '../service/clients.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateClientDto } from '../dtos/create-client.dto';
import { UpdateClientDto } from '../dtos/update-client.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { FindAllClientsQueryDto } from '../dtos/find-all-clients-query.dto';

describe('ClientsService', () => {
  let service: ClientsService;

  const mockPrisma = {
    client: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
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
    role: 'CLIENT',
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
    const mockClients = [
      { id: 1, fullName: 'Test', user: { email: 'a@a.com', role: 'CLIENT' } },
    ];
    const totalItems = 35;
    const pageSize = 20;

    beforeEach(() => {
      mockPrisma.client.count.mockResolvedValue(totalItems);
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
    });

    it('should return clients data and pagination metadata with default query', async () => {
      const page = 1;
      const query: FindAllClientsQueryDto = { page };

      const result = await service.findAll(query);

      expect(mockPrisma.client.count).toHaveBeenCalledWith({ where: {} });
      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: pageSize,
          where: {},
        }),
      );

      expect(result.data).toEqual(mockClients);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should apply fullName filter (case-insensitive)', async () => {
      const query: FindAllClientsQueryDto = { page: 1, fullName: 'Joao' };
      await service.findAll(query);

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fullName: { contains: 'Joao', mode: 'insensitive' } },
        }),
      );
    });

    it('should apply email filter (case-insensitive via user relation)', async () => {
      const query: FindAllClientsQueryDto = { page: 1, email: 'teste@email' };
      await service.findAll(query);

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user: { email: { contains: 'teste@email', mode: 'insensitive' } },
          },
        }),
      );
    });

    it('should apply status filter', async () => {
      const query: FindAllClientsQueryDto = { page: 1, status: false };
      await service.findAll(query);

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: false },
        }),
      );
    });

    it('should apply combination of filters', async () => {
      const query: FindAllClientsQueryDto = {
        page: 1,
        fullName: 'Jane',
        status: true,
      };
      await service.findAll(query);

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fullName: { contains: 'Jane', mode: 'insensitive' },
            status: true,
          },
        }),
      );
    });

    it('should calculate skip correctly for a subsequent page (page 2)', async () => {
      const page = 2;
      const query: FindAllClientsQueryDto = { page };

      await service.findAll(query);

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      );
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
        role: 'CLIENT',
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
    it('should update client for admin, including status', async () => {
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
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: dto,
        }),
      );
    });

    it('should update client for owner, excluding status', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.client.update.mockResolvedValue({
        ...client,
        fullName: 'Updated',
      });

      const dto: UpdateClientDto = { fullName: 'Updated', status: false };
      const result = await service.update(1, dto, clientUser);

      expect(result.fullName).toBe('Updated');
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { fullName: 'Updated' },
        }),
      );
    });

    it('should throw if not owner and not admin', async () => {
      const client = { id: 1, userId: 2 };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      const dto: UpdateClientDto = { fullName: 'Updated' };

      const otherUser: AuthenticatedUser = {
        id: 3,
        email: 'other@test.com',
        role: 'CLIENT',
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
