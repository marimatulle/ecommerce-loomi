import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { FindAllProductsQueryDto } from '../dtos/find-all-products-query.dto';
import { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto, user: AuthenticatedUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can create products');
    }

    if (dto.stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    return this.prisma.product.create({ data: dto });
  }

  async findAll(query: FindAllProductsQueryDto) {
    const { page, name, minPrice, maxPrice, available } = query;
    const skip = (page - 1) * PAGE_SIZE;

    const where: Prisma.ProductWhereInput = {};

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        where.price.gte = minPrice;
      }
      if (maxPrice) {
        where.price.lte = maxPrice;
      }
    }

    if (available !== undefined) {
      if (available === true) {
        where.stock = { gt: 0 };
      } else {
        where.stock = { equals: 0 };
      }
    }

    const totalCount = await this.prisma.product.count({ where });

    const products = await this.prisma.product.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { id: 'asc' },
    });

    return {
      data: products,
      meta: {
        totalItems: totalCount,
        itemCount: products.length,
        itemsPerPage: PAGE_SIZE,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
        currentPage: page,
      },
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: number, dto: UpdateProductDto, user: AuthenticatedUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update products');
    }

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.stock !== undefined && dto.stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number, user: AuthenticatedUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can delete products');
    }

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.product.delete({ where: { id } });
  }
}
