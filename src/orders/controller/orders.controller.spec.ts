import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from '../service/orders.service';
import { AuthGuard } from 'src/auth/auth.guard';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockUser = { id: 2, email: 'client@test.com', role: 'CLIENT' };
  const mockReq = { user: mockUser } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create an order', async () => {
    const dto = { items: [{ productId: 1, quantity: 2 }] };
    const created = { id: 100, ...dto };

    (service.create as jest.Mock).mockResolvedValue(created);
    const result = await controller.create(mockReq, dto);

    expect(result).toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto, mockUser);
  });

  it('should return all orders', async () => {
    const orders = [{ id: 100 }];
    (service.findAll as jest.Mock).mockResolvedValue(orders);

    const result = await controller.findAll(mockReq);
    expect(result).toEqual(orders);
    expect(service.findAll).toHaveBeenCalledWith(mockUser);
  });

  it('should return single order', async () => {
    const order = { id: 100 };
    (service.findOne as jest.Mock).mockResolvedValue(order);

    const result = await controller.findOne('100');
    expect(result).toEqual(order);
    expect(service.findOne).toHaveBeenCalledWith(100);
  });

  it('should update order status', async () => {
    const updated = { id: 100, status: 'CANCELED' };
    (service.update as jest.Mock).mockResolvedValue(updated);

    const result = await controller.updateStatus(
      '100',
      { status: 'CANCELED' },
      mockReq,
    );
    expect(result).toEqual(updated);
    expect(service.update).toHaveBeenCalledWith(
      100,
      { status: 'CANCELED' },
      mockUser,
    );
  });

  it('should remove order', async () => {
    const removed = { id: 100 };
    (service.remove as jest.Mock).mockResolvedValue(removed);

    const result = await controller.remove('100', mockReq);
    expect(result).toEqual(removed);
    expect(service.remove).toHaveBeenCalledWith(100, mockUser);
  });
});
