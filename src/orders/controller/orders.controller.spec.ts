import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from '../controller/orders.controller';
import { OrdersService } from '../service/orders.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UpdateOrderDto } from '../dtos/update-order.dto';
import { FindAllOrdersQueryDto } from '../dtos/find-all-orders-query.dto';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockUser: AuthenticatedUser = {
    id: 2,
    email: 'client@test.com',
    role: 'CLIENT' as any,
  };
  const mockReq = { user: mockUser } as any;

  const mockOrdersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getCart: jest.fn(),
    addToCart: jest.fn(),
    checkout: jest.fn(),
    removeFromCart: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Order CRUD', () => {
    it('should call service.create and return the result', async () => {
      const dto = { items: [{ productId: 1, quantity: 2 }] };
      const created = { id: 100, ...dto };

      (service.create as jest.Mock).mockResolvedValue(created);
      const result = await controller.create(mockReq, dto as any);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(dto, mockUser);
    });

    it('should call service.findAll with default query and return paginated result', async () => {
      const defaultQuery: FindAllOrdersQueryDto = { page: 1 };
      const paginatedOrders = {
        data: [{ id: 100 }],
        meta: { currentPage: 1, totalItems: 1 },
      };
      (service.findAll as jest.Mock).mockResolvedValue(paginatedOrders);
      const result = await controller.findAll(mockReq, defaultQuery);
      expect(result).toEqual(paginatedOrders);
      expect(service.findAll).toHaveBeenCalledWith(mockUser, defaultQuery);
    });

    it('should call service.findAll with specific filters and return paginated result', async () => {
      const specificQuery: FindAllOrdersQueryDto = {
        page: 2,
        status: 'SHIPPED',
        startDate: '2023-01-01',
      };
      const paginatedOrders = {
        data: [{ id: 100, status: 'SHIPPED' }],
        meta: { currentPage: 2, totalItems: 45 },
      };
      (service.findAll as jest.Mock).mockResolvedValue(paginatedOrders);
      const result = await controller.findAll(mockReq, specificQuery);
      expect(result).toEqual(paginatedOrders);
      expect(service.findAll).toHaveBeenCalledWith(mockUser, specificQuery);
    });

    it('should call service.findOne and return the result', async () => {
      const order = { id: 100 };
      (service.findOne as jest.Mock).mockResolvedValue(order);

      const result = await controller.findOne(100, mockReq);
      expect(result).toEqual(order);
      expect(service.findOne).toHaveBeenCalledWith(100, mockUser);
    });

    it('should call service.update and return the result', async () => {
      const dto: UpdateOrderDto = { status: 'CANCELED' as any };
      const updated = { id: 100, status: 'CANCELED' };
      (service.update as jest.Mock).mockResolvedValue(updated);

      const result = await controller.update(100, dto, mockReq);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(100, dto, mockUser);
    });

    it('should call service.remove and return the result', async () => {
      const removed = { id: 100 };
      (service.remove as jest.Mock).mockResolvedValue(removed);

      const result = await controller.remove(100, mockReq);

      expect(result).toEqual(removed);
      expect(service.remove).toHaveBeenCalledWith(100, mockUser);
    });
  });

  describe('Cart Endpoints', () => {
    const cart = { id: 10, items: [] };

    it('should call service.getCart and return the result', async () => {
      (service.getCart as jest.Mock).mockResolvedValue(cart);
      const result = await controller.getCart(mockReq);

      expect(result).toEqual(cart);
      expect(service.getCart).toHaveBeenCalledWith(mockUser);
    });

    it('should call service.addToCart and return the result', async () => {
      const dto = { items: [{ productId: 1, quantity: 1 }] };
      (service.addToCart as jest.Mock).mockResolvedValue(cart);

      const result = await controller.addToCart(mockReq, dto as any);

      expect(result).toEqual(cart);
      expect(service.addToCart).toHaveBeenCalledWith(dto, mockUser);
    });

    it('should call service.checkout and return the ordered order', async () => {
      const orderedOrder = { id: 10, status: 'ORDERED' };
      (service.checkout as jest.Mock).mockResolvedValue(orderedOrder);

      const result = await controller.checkout(mockReq);

      expect(result).toEqual(orderedOrder);
      expect(service.checkout).toHaveBeenCalledWith(mockUser);
    });

    it('should call service.removeFromCart with provided quantity', async () => {
      const expectedResult = { status: 'UPDATED' };
      (service.removeFromCart as jest.Mock).mockResolvedValue(expectedResult);

      const productId = 5;
      const quantityToRemove = 2;

      const result = await controller.removeFromCart(
        productId,
        mockReq,
        quantityToRemove,
      );

      expect(result).toEqual(expectedResult);
      expect(service.removeFromCart).toHaveBeenCalledWith(
        productId,
        mockUser,
        quantityToRemove,
      );
    });

    it('should call service.removeFromCart with undefined quantity when not provided', async () => {
      const expectedResult = { status: 'UPDATED_DEFAULT' };
      (service.removeFromCart as jest.Mock).mockResolvedValue(expectedResult);

      const productId = 5;

      const result = await controller.removeFromCart(
        productId,
        mockReq,
        undefined,
      );

      expect(result).toEqual(expectedResult);
      expect(service.removeFromCart).toHaveBeenCalledWith(
        productId,
        mockUser,
        undefined,
      );
    });
  });
});
