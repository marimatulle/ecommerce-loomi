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

  async findAll(page: number = 1) {
    const skip = (page - 1) * PAGE_SIZE;

    const totalCount = await this.prisma.product.count();

    const products = await this.prisma.product.findMany({
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
