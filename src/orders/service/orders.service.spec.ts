import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../service/orders.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { OrderStatus, UserRole } from '@prisma/client';
import Decimal from 'decimal.js';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { FindAllOrdersQueryDto } from '../dtos/find-all-orders-query.dto';

const mockGetClient: jest.Mock = jest.fn();
const mockCalculateTotal: jest.Mock = jest.fn();
const mockRecalculateCartTotal: jest.Mock = jest.fn();

jest.mock('../utils/order.utils', () => ({
  getClient: (...args) => mockGetClient(...args),
  calculateTotal: (...args) => mockCalculateTotal(...args),
  recalculateCartTotal: (...args) => mockRecalculateCartTotal(...args),
}));

describe('OrdersService', () => {
  let service: OrdersService;

  const CART_ID = 5;
  const PRODUCT_ID = 1;
  const ITEM_ID = 10;
  const PAGE_SIZE = 20;

  const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
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
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
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

  const mockCartWithThreeItems = {
    id: CART_ID,
    clientId: 1,
    status: OrderStatus.CART,
    total: new Decimal(30),
    items: [
      {
        id: ITEM_ID,
        productId: PRODUCT_ID,
        quantity: 3,
        unitPrice: new Decimal(10),
        subtotal: new Decimal(30),
      },
    ],
  };
  const MOCK_PRODUCT = {
    id: PRODUCT_ID,
    price: new Decimal(10),
    stock: 10,
    name: 'Test Product',
  };

  beforeEach(async () => {
    mockGetClient.mockImplementation((_prisma, user) =>
      Promise.resolve({ id: 1, userId: user.id }),
    );
    mockCalculateTotal.mockImplementation(() => ({
      total: 20,
      orderItems: [{ productId: 1, quantity: 2, subtotal: 20 }],
    }));
    mockRecalculateCartTotal.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();

    mockPrisma.order.findFirst.mockResolvedValue(mockCartWithThreeItems);
    mockPrisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);
  });

  describe('create', () => {
    it('should create a new order', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 1, price: new Decimal(10), stock: 10 },
      ]);
      mockPrisma.order.create.mockResolvedValue({
        id: 1,
        clientId: 1,
        total: 20,
        status: OrderStatus.ORDERED,
        items: [],
      });

      const dto: CreateOrderDto = { items: [{ productId: 1, quantity: 2 }] };
      const result = await service.create(dto, clientUser);

      expect(result.id).toBe(1);
      expect(mockPrisma.order.create).toHaveBeenCalled();
    });

    it('should throw if client profile not found', async () => {
      mockGetClient.mockRejectedValueOnce(
        new NotFoundException('Client not found'),
      );
      const dto: CreateOrderDto = { items: [{ productId: 1, quantity: 2 }] };
      await expect(service.create(dto, clientUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    const totalOrders = 35;
    const orders = [{ id: 1 }, { id: 2 }];

    beforeEach(() => {
      mockPrisma.order.findMany.mockResolvedValue(orders);
      mockPrisma.order.count.mockResolvedValue(totalOrders);
    });

    it('should return paginated orders and metadata for admin (all non-cart orders)', async () => {
      const query: FindAllOrdersQueryDto = { page: 1 };
      await service.findAll(adminUser, query);

      expect(mockPrisma.order.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { not: OrderStatus.CART } },
        }),
      );

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { not: OrderStatus.CART } },
          skip: 0,
          take: PAGE_SIZE,
          orderBy: { id: 'asc' },
          include: { items: true, client: { select: expect.any(Object) } },
        }),
      );
    });

    it('should return paginated orders and metadata for client (filtered by clientId)', async () => {
      const clientOrdersCount = 15;
      const query: FindAllOrdersQueryDto = { page: 1 };

      mockPrisma.order.count.mockResolvedValue(clientOrdersCount);

      await service.findAll(clientUser, query);
      const expectedWhere = {
        status: { not: OrderStatus.CART },
        clientId: 1,
      };

      expect(mockPrisma.order.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          include: { items: true },
        }),
      );
    });

    it('should apply status filter correctly', async () => {
      const query: FindAllOrdersQueryDto = {
        page: 1,
        status: OrderStatus.SHIPPED,
      };
      await service.findAll(adminUser, query);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: OrderStatus.SHIPPED },
        }),
      );
    });

    it('should apply startDate filter correctly', async () => {
      const startDate = '2023-10-01';
      const query: FindAllOrdersQueryDto = { page: 1, startDate };
      await service.findAll(adminUser, query);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { not: OrderStatus.CART },
            orderDate: { gte: new Date(startDate) },
          },
        }),
      );
    });

    it('should apply endDate filter correctly', async () => {
      const endDate = '2023-10-31';
      const query: FindAllOrdersQueryDto = { page: 1, endDate };
      await service.findAll(adminUser, query);

      const expectedEnd = new Date(endDate);
      expectedEnd.setHours(23, 59, 59, 999);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { not: OrderStatus.CART },
            orderDate: { lte: expectedEnd },
          },
        }),
      );
    });

    it('should apply both startDate and endDate filters correctly', async () => {
      const startDate = '2023-10-01';
      const endDate = '2023-10-31';
      const query: FindAllOrdersQueryDto = { page: 1, startDate, endDate };
      await service.findAll(adminUser, query);

      const expectedEnd = new Date(endDate);
      expectedEnd.setHours(23, 59, 59, 999);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { not: OrderStatus.CART },
            orderDate: { gte: new Date(startDate), lte: expectedEnd },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    const order = { id: 1, clientId: 1, items: [] };

    it('should return order if found (no user context)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      const result = await service.findOne(1);
      expect(result).toEqual(order);
    });

    it('should return order for admin user', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      const result = await service.findOne(1, adminUser);
      expect(result).toEqual(order);
    });

    it('should return order for owner client', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      const result = await service.findOne(1, clientUser);
      expect(result).toEqual(order);
    });

    it('should throw ForbiddenException if client tries to access other client order', async () => {
      const otherOrder = { id: 2, clientId: 2, items: [] };
      mockPrisma.order.findUnique.mockResolvedValue(otherOrder);

      await expect(service.findOne(2, clientUser)).rejects.toThrow(
        ForbiddenException,
      );
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
        clientId: 1,
        status: OrderStatus.ORDERED,
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
      expect(mockPrisma.order.update).toHaveBeenCalled();
    });

    it('should update status for client when allowed (RECEIVED)', async () => {
      mockPrisma.order.update.mockResolvedValue({
        id: orderId,
        status: OrderStatus.RECEIVED,
      });
      const result = await service.update(
        orderId,
        { status: OrderStatus.RECEIVED } as any,
        clientUser,
      );
      expect(result.status).toBe(OrderStatus.RECEIVED);
      expect(mockPrisma.order.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if client tries to set admin-only status (PREPARING)', async () => {
      await expect(
        service.update(
          orderId,
          { status: OrderStatus.PREPARING } as any,
          clientUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete order for admin', async () => {
      const order = { id: 1 };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.delete.mockResolvedValue(order);

      const result = await service.remove(1, adminUser);
      expect(result).toEqual(order);
      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw ForbiddenException for client', async () => {
      await expect(service.remove(1, clientUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getCart', () => {
    it('should return the active cart', async () => {
      const result = await service.getCart(clientUser);

      expect(result).toEqual(mockCartWithThreeItems);
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: 1, status: OrderStatus.CART },
        }),
      );
    });

    it('should throw NotFoundException if no active cart exists', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(service.getCart(clientUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addToCart', () => {
    const dto: CreateOrderDto = {
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
    };
    const mockProducts = [MOCK_PRODUCT];

    beforeEach(() => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockPrisma.order.findFirst.mockResolvedValue(mockCartWithThreeItems);
    });

    it('should create a new cart if none exists', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);
      mockPrisma.order.create.mockResolvedValue({
        id: 99,
        status: OrderStatus.CART,
        items: [],
      });

      await service.addToCart(dto, clientUser);

      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockCalculateTotal).toHaveBeenCalled();
      expect(mockPrisma.orderItem.update).not.toHaveBeenCalled();
    });

    it('should update an existing item and recalculate total', async () => {
      await service.addToCart(dto, clientUser);

      expect(mockPrisma.orderItem.update).toHaveBeenCalled();
      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ITEM_ID },
          data: expect.objectContaining({
            quantity: 5,
          }),
        }),
      );
      expect(mockRecalculateCartTotal).toHaveBeenCalledWith(
        mockPrisma,
        CART_ID,
      );
    });
  });

  describe('checkout', () => {
    const mockCartItems = [{ id: 10, productId: PRODUCT_ID, quantity: 2 }];
    const cartToCheckout = {
      ...mockCartWithThreeItems,
      items: mockCartItems,
      total: new Decimal(20),
      status: OrderStatus.CART,
    };
    const finishedOrder = { ...cartToCheckout, status: OrderStatus.ORDERED };

    beforeEach(() => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(cartToCheckout);
      mockPrisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);
      mockPrisma.order.update.mockResolvedValue(finishedOrder);
    });

    it('should update cart status to ORDERED and deduce product stock within a transaction', async () => {
      await service.checkout(clientUser);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PRODUCT_ID },
          data: { stock: MOCK_PRODUCT.stock - 2 },
        }),
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: cartToCheckout.id },
          data: { status: OrderStatus.ORDERED },
        }),
      );
    });

    it('should throw BadRequestException if stock is insufficient during checkout', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...MOCK_PRODUCT,
        stock: 1,
      });

      await expect(service.checkout(clientUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeFromCart (with quantity)', () => {
    const mockOrderItem = {
      id: ITEM_ID,
      orderId: CART_ID,
      productId: PRODUCT_ID,
      quantity: 3,
      unitPrice: 10,
      subtotal: 30,
    };
    const mockProduct = {
      id: PRODUCT_ID,
      price: new Decimal(10),
      name: 'Test Product',
    };

    beforeEach(() => {
      mockPrisma.orderItem.findFirst.mockResolvedValue(mockOrderItem);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.orderItem.count.mockResolvedValue(1);
    });

    it('should remove the exact quantity and update order item (remaining > 0)', async () => {
      const quantityToRemove = 2;
      const newQuantity = 1;
      const newSubtotal = 10;

      await service.removeFromCart(PRODUCT_ID, clientUser, quantityToRemove);

      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ITEM_ID },
          data: {
            quantity: newQuantity,
            subtotal: newSubtotal,
          },
        }),
      );
      expect(mockPrisma.orderItem.delete).not.toHaveBeenCalled();
      expect(mockRecalculateCartTotal).toHaveBeenCalledWith(
        mockPrisma,
        CART_ID,
      );
    });

    it('should delete the order item if remaining quantity is 0', async () => {
      const quantityToRemove = 3;

      await service.removeFromCart(PRODUCT_ID, clientUser, quantityToRemove);

      expect(mockPrisma.orderItem.delete).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
      });
      expect(mockPrisma.orderItem.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if quantityToRemove is negative', async () => {
      await expect(
        service.removeFromCart(PRODUCT_ID, clientUser, -1),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
