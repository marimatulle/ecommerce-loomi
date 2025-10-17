import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from 'src/products/service/products.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from 'src/products/dtos/create-product.dto';
import { UpdateProductDto } from 'src/products/dtos/update-product.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

describe('ProductsService', () => {
  let service: ProductsService;
  const mockPrisma = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const adminUser: AuthenticatedUser = {
    id: 1,
    email: 'admin@test.com',
    role: 'ADMIN',
  };

  const normalUser: AuthenticatedUser = {
    id: 2,
    email: 'user@test.com',
    role: 'USER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product for admin', async () => {
      const dto: CreateProductDto = {
        name: 'Ração Premium',
        description: 'Ração top',
        price: 149.9,
        stock: 5,
      };
      const created = { id: 1, ...dto };

      mockPrisma.product.create.mockResolvedValue(created);

      const result = await service.create(dto, adminUser);

      expect(result).toEqual(created);
      expect(mockPrisma.product.create).toHaveBeenCalledWith({ data: dto });
    });

    it('should throw if user is not admin', async () => {
      const dto: CreateProductDto = {
        name: 'Ração',
        description: 'Desc',
        price: 10,
        stock: 1,
      };
      await expect(service.create(dto, normalUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if stock is negative', async () => {
      const dto: CreateProductDto = {
        name: 'Ração',
        description: 'Desc',
        price: 10,
        stock: -5,
      };
      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all products', async () => {
      const products = [{ id: 1, name: 'Ração' }];
      mockPrisma.product.findMany.mockResolvedValue(products);

      const result = await service.findAll();
      expect(result).toEqual(products);
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return product if exists', async () => {
      const product = { id: 1, name: 'Ração' };
      mockPrisma.product.findUnique.mockResolvedValue(product);

      const result = await service.findOne(1);
      expect(result).toEqual(product);
    });

    it('should throw if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update product for admin', async () => {
      const dto: UpdateProductDto = { price: 200 };
      const product = { id: 1, name: 'Ração' };
      const updated = { ...product, price: 200 };

      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.product.update.mockResolvedValue(updated);

      const result = await service.update(1, dto, adminUser);
      expect(result).toEqual(updated);
    });

    it('should throw if user not admin', async () => {
      const dto: UpdateProductDto = { price: 200 };
      await expect(service.update(1, dto, normalUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if stock is negative', async () => {
      const dto: UpdateProductDto = { stock: -1 };
      mockPrisma.product.findUnique.mockResolvedValue({ id: 1 });
      await expect(service.update(1, dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const dto: UpdateProductDto = { price: 200 };
      await expect(service.update(1, dto, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete product for admin', async () => {
      const product = { id: 1, name: 'Ração' };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.product.delete.mockResolvedValue(product);

      const result = await service.remove(1, adminUser);
      expect(result).toEqual(product);
    });

    it('should throw if user not admin', async () => {
      await expect(service.remove(1, normalUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.remove(1, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
