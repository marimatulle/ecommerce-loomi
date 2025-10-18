import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from 'src/products/controller/products.controller';
import { ProductsService } from 'src/products/service/products.service';
import { AuthGuard } from 'src/auth/auth.guard';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockAdmin = { id: 1, email: 'admin@email.com', role: 'ADMIN' };
  const mockUser = { id: 2, email: 'user@email.com', role: 'USER' };
  const mockReqAdmin = { user: mockAdmin } as any;
  const mockReqUser = { user: mockUser } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
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

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a product (admin only)', async () => {
    const dto = {
      name: 'Ração Premium',
      description: 'Ração balanceada',
      price: 149.9,
      stock: 10,
    };
    const created = { id: 1, ...dto };

    (service.create as jest.Mock).mockResolvedValue(created);

    const result = await controller.create(mockReqAdmin, dto);

    expect(result).toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto, mockAdmin);
  });

  it('should throw forbidden when non-admin tries to create product', async () => {
    const dto = {
      name: 'Ração Premium',
      description: 'Ração balanceada',
      price: 149.9,
      stock: 10,
    };

    (service.create as jest.Mock).mockRejectedValue(
      new Error('Only admins can create products'),
    );

    await expect(controller.create(mockReqUser, dto)).rejects.toThrow(
      'Only admins can create products',
    );
  });

  it('should return all products with pagination data for a given page', async () => {
    const productsData = [{ id: 1, name: 'Ração 1' }];
    const paginatedResult = {
      data: productsData,
      meta: {
        totalItems: 25,
        itemCount: 1,
        itemsPerPage: 20,
        totalPages: 2,
        currentPage: 2,
      },
    };
    (service.findAll as jest.Mock).mockResolvedValue(paginatedResult);

    const pageNumber = 2;

    const result = await controller.findAll(pageNumber);

    expect(result).toEqual(paginatedResult);
    expect(service.findAll).toHaveBeenCalledWith(pageNumber);
  });

  it('should call service.findAll with page 1 when no query is provided (default)', async () => {
    const paginatedResult = { data: [], meta: { currentPage: 1 } };
    (service.findAll as jest.Mock).mockResolvedValue(paginatedResult);

    await controller.findAll(1);

    expect(service.findAll).toHaveBeenCalledWith(1);
  });

  it('should return one product by id', async () => {
    const product = { id: 1, name: 'Ração' };
    (service.findOne as jest.Mock).mockResolvedValue(product);

    const result = await controller.findOne('1');

    expect(result).toEqual(product);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it('should update a product (admin only)', async () => {
    const dto = { price: 199.9 };
    const updated = { id: 1, ...dto };

    (service.update as jest.Mock).mockResolvedValue(updated);

    const result = await controller.update('1', dto, mockReqAdmin);

    expect(result).toEqual(updated);
    expect(service.update).toHaveBeenCalledWith(1, dto, mockAdmin);
  });

  it('should remove a product (admin only)', async () => {
    const removed = { id: 1, name: 'Ração' };
    (service.remove as jest.Mock).mockResolvedValue(removed);

    const result = await controller.remove('1', mockReqAdmin);

    expect(result).toEqual(removed);
    expect(service.remove).toHaveBeenCalledWith(1, mockAdmin);
  });
});
