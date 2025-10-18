import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { OrderStatus, UserRole } from '@prisma/client';
import Decimal from 'decimal.js';
import { CreateOrderDto } from '../dtos/create-order.dto';

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
    const adminUser: AuthenticatedUser = {
      id: 99,
      email: 'admin@test.com',
      role: UserRole.ADMIN,
    };

    it('should return all orders for admin', async () => {
      const orders = [{ id: 1 }];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.findAll(adminUser);
      expect(result).toEqual(orders);
    });

    it('should return client orders', async () => {
      const orders = [{ id: 1 }];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      await service.findAll(clientUser);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 1 } }),
      );
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
        clientId: 1,
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
  });

  describe('remove', () => {
    it('should delete order for admin', async () => {
      const order = { id: 1 };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.delete.mockResolvedValue(order);

      const result = await service.remove(1, adminUser);
      expect(result).toEqual(order);
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

    beforeEach(() => {
      mockPrisma.orderItem.findFirst.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockCartWithThreeItems);
    });

    it('should throw BadRequestException if quantityToRemove is <= 0', async () => {
      await expect(
        service.removeFromCart(PRODUCT_ID, clientUser, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reduce quantity and update subtotal (partial removal)', async () => {
      const quantityToRemove = 1;
      const newQuantity = mockOrderItem.quantity - quantityToRemove;
      const newSubtotal = newQuantity * mockOrderItem.unitPrice;

      const updatedCart = {
        ...mockCartWithThreeItems,
        total: new Decimal(newSubtotal),
        items: [
          {
            ...mockOrderItem,
            quantity: newQuantity,
            subtotal: new Decimal(newSubtotal),
          },
        ],
      };

      mockPrisma.orderItem.count.mockResolvedValue(1);
      mockPrisma.order.findFirst.mockResolvedValue(updatedCart);

      await service.removeFromCart(PRODUCT_ID, clientUser, quantityToRemove);

      expect(mockPrisma.orderItem.update).toHaveBeenCalled();
      expect(mockRecalculateCartTotal).toHaveBeenCalledWith(
        mockPrisma,
        CART_ID,
      );
    });

    it('should delete order item if quantityToRemove >= current quantity (total removal)', async () => {
      const quantityToRemove = 5;

      mockPrisma.orderItem.count.mockResolvedValue(1);
      mockPrisma.orderItem.delete.mockResolvedValue(mockOrderItem);

      await service.removeFromCart(PRODUCT_ID, clientUser, quantityToRemove);

      expect(mockPrisma.orderItem.delete).toHaveBeenCalled();
      expect(mockPrisma.order.delete).not.toHaveBeenCalled();
    });

    it('should delete cart and return success object if it becomes empty', async () => {
      const quantityToRemove = 3;

      mockPrisma.orderItem.count.mockResolvedValue(0);
      mockPrisma.orderItem.delete.mockResolvedValue(mockOrderItem);

      const result = await service.removeFromCart(
        PRODUCT_ID,
        clientUser,
        quantityToRemove,
      );

      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: CART_ID },
      });
      expect(result).toEqual({
        statusCode: 200,
        message:
          'Item removed successfully. Cart is now empty and has been deleted.',
        cart: null,
      });
    });
  });
});
