import { Test, TestingModule } from '@nestjs/testing';
import { ClientsController } from 'src/clients/controller/clients.controller';
import { ClientsService } from 'src/clients/service/clients.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { FindAllClientsQueryDto } from 'src/clients/dtos/find-all-clients-query.dto';

describe('ClientsController', () => {
  let controller: ClientsController;
  let service: ClientsService;

  const mockUser = { id: 1, email: 'user@email.com', role: 'CLIENT' };
  const mockReq = { user: mockUser } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [
        {
          provide: ClientsService,
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

    controller = module.get<ClientsController>(ClientsController);
    service = module.get<ClientsService>(ClientsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a client', async () => {
    const dto = {
      fullName: 'Test User',
      contact: '999999999',
      address: 'Street 123',
    };
    const created = { id: 1, ...dto, userId: mockUser.id };

    (service.create as jest.Mock).mockResolvedValue(created);

    const result = await controller.create(mockReq, dto);

    expect(result).toEqual(created);
    expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
  });

  it('should return all clients with default query', async () => {
    const clientsData = [{ id: 1, fullName: 'Test Client' }];
    const defaultQuery: FindAllClientsQueryDto = { page: 1 };
    const paginatedResult = {
      data: clientsData,
      meta: {
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 20,
        totalPages: 1,
        currentPage: 1,
      },
    };

    (service.findAll as jest.Mock).mockResolvedValue(paginatedResult);

    const result = await controller.findAll(defaultQuery);

    expect(result).toEqual(paginatedResult);
    expect(service.findAll).toHaveBeenCalledWith(defaultQuery);
  });

  it('should return all clients with specific filters', async () => {
    const clientsData = [{ id: 2, fullName: 'Filtered Client' }];
    const filteredQuery: FindAllClientsQueryDto = {
      page: 2,
      fullName: 'Filter',
      status: true,
    };
    const paginatedResult = {
      data: clientsData,
      meta: {
        totalItems: 5,
        itemCount: 1,
        itemsPerPage: 20,
        totalPages: 1,
        currentPage: 2,
      },
    };

    (service.findAll as jest.Mock).mockResolvedValue(paginatedResult);

    const result = await controller.findAll(filteredQuery);

    expect(result).toEqual(paginatedResult);
    expect(service.findAll).toHaveBeenCalledWith(filteredQuery);
  });

  it('should return a single client', async () => {
    const client = { id: 1, fullName: 'Test Client' };
    (service.findOne as jest.Mock).mockResolvedValue(client);

    const result = await controller.findOne('1', mockReq);

    expect(result).toEqual(client);
    expect(service.findOne).toHaveBeenCalledWith(1, mockUser);
  });

  it('should update a client', async () => {
    const dto = { fullName: 'Updated Name' };
    const updated = { id: 1, ...dto };

    (service.update as jest.Mock).mockResolvedValue(updated);

    const result = await controller.update('1', dto, mockReq);

    expect(result).toEqual(updated);
    expect(service.update).toHaveBeenCalledWith(1, dto, mockUser);
  });

  it('should remove a client', async () => {
    const removed = { success: true };
    (service.remove as jest.Mock).mockResolvedValue(removed);

    const result = await controller.remove('1');

    expect(result).toEqual(removed);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
