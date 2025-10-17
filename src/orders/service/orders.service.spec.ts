import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { OrderStatus, UserRole } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockPrisma = {
    client: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
  };

  const adminUser: AuthenticatedUser = {
    id: 99,
    email: 'admin@test.com',
    role: UserRole.ADMIN,
  };

  const clientUser: AuthenticatedUser = {
    id: 2,
    email: 'client@test.com',
    role: UserRole.CLIENT,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new order', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 1, userId: 2 });
      mockPrisma.product.findMany.mockResolvedValue([{ id: 1, price: 10 }]);
      mockPrisma.order.create.mockResolvedValue({
        id: 1,
        clientId: 1,
        total: 20,
        status: OrderStatus.ORDERED,
        items: [],
      });

      const dto = { items: [{ productId: 1, quantity: 2 }] };
      const result = await service.create(dto as any, clientUser);

      expect(result.id).toBe(1);
      expect(mockPrisma.order.create).toHaveBeenCalled();
    });

    it('should throw if client profile not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      const dto = { items: [{ productId: 1, quantity: 2 }] };
      await expect(service.create(dto as any, clientUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all orders for admin', async () => {
      const orders = [{ id: 1 }];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.findAll(adminUser);
      expect(result).toEqual(orders);
    });

    it('should return client orders', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 1 });
      const orders = [{ id: 1 }];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.findAll(clientUser);
      expect(result).toEqual(orders);
    });
  });

  describe('findOne', () => {
    it('should return order if found', async () => {
      const order = { id: 1, items: [] };
      mockPrisma.order.findUnique.mockResolvedValue(order);

      const result = await service.findOne(1);
      expect(result).toEqual(order);
    });

    it('should throw if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const orderId = 100;

    beforeEach(() => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: orderId,
        clientId: 10,
      });
    });

    it('should update status for admin', async () => {
      mockPrisma.order.update.mockResolvedValue({
        id: orderId,
        status: OrderStatus.SHIPPED,
      });
      const result = await service.update(
        orderId,
        { status: OrderStatus.SHIPPED } as any,
        adminUser,
      );
      expect(result.status).toBe(OrderStatus.SHIPPED);
    });

    it('should throw if client tries to update other order', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 2 });
      await expect(
        service.update(
          orderId,
          { status: OrderStatus.CANCELED } as any,
          clientUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    describe('PREPARING stock reduction', () => {
      const productId = 1;

      beforeEach(() => {
        mockPrisma.orderItem.findMany.mockResolvedValue([
          { productId, quantity: 2 },
        ]);
      });

      it('should reduce product stock when preparing order', async () => {
        mockPrisma.product.findUnique.mockResolvedValue({
          id: productId,
          stock: 5,
          name: 'Product 1',
        });
        mockPrisma.product.update.mockResolvedValue({
          id: productId,
          stock: 3,
        });
        mockPrisma.order.update.mockResolvedValue({
          id: orderId,
          status: OrderStatus.PREPARING,
        });

        const result = await service.update(
          orderId,
          { status: OrderStatus.PREPARING } as any,
          adminUser,
        );

        expect(result.status).toBe(OrderStatus.PREPARING);
        expect(mockPrisma.product.update).toHaveBeenCalledWith({
          where: { id: productId },
          data: { stock: 3 },
        });
      });

      it('should throw if product stock is insufficient', async () => {
        mockPrisma.product.findUnique.mockResolvedValue({
          id: productId,
          stock: 1,
          name: 'Product 1',
        });

        await expect(
          service.update(
            orderId,
            { status: OrderStatus.PREPARING } as any,
            adminUser,
          ),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.product.update).not.toHaveBeenCalled();
      });

      it('should throw if product not found', async () => {
        mockPrisma.product.findUnique.mockResolvedValue(null);

        await expect(
          service.update(
            orderId,
            { status: OrderStatus.PREPARING } as any,
            adminUser,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('remove', () => {
    it('should delete order for admin', async () => {
      const order = { id: 1 };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.delete.mockResolvedValue(order);

      const result = await service.remove(1, adminUser);
      expect(result).toEqual(order);
    });

    it('should throw if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      await expect(service.remove(1, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if non-admin tries to delete', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 1 });
      await expect(service.remove(1, clientUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
