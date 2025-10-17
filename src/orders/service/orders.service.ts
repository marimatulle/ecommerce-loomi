import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { UpdateOrderDto } from '../dtos/update-order.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { Prisma, OrderStatus, UserRole } from '@prisma/client';
import DecimalJS from 'decimal.js';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Only clients can create orders');
    }

    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      throw new NotFoundException('Client profile not found for this user');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });

    if (products.length !== dto.items.length) {
      throw new NotFoundException('Some products not found');
    }

    let total = new DecimalJS(0);

    const orderItems: Prisma.OrderItemCreateManyOrderInput[] = dto.items.map(
      (item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product)
          throw new NotFoundException(`Product ${item.productId} not found`);

        const subtotal = new DecimalJS(product.price.toString()).times(
          item.quantity,
        );
        total = total.plus(subtotal);

        return {
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
          subtotal: subtotal.toNumber(),
        };
      },
    );

    const order = await this.prisma.order.create({
      data: {
        clientId: client.id,
        total: total.toNumber(),
        status: OrderStatus.ORDERED,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    return order;
  }

  async findAll(user: AuthenticatedUser) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.order.findMany({
        include: { items: true, client: true },
      });
    }

    const client = await this.prisma.client.findUnique({
      where: { userId: user.id },
    });

    if (!client) {
      throw new NotFoundException('Client profile not found for this user');
    }

    return this.prisma.order.findMany({
      where: { clientId: client.id },
      include: { items: true },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async update(id: number, dto: UpdateOrderDto, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const adminOnlyStatuses: OrderStatus[] = [
      OrderStatus.ORDERED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const clientAllowedStatuses: OrderStatus[] = [
      OrderStatus.RECEIVED,
      OrderStatus.CANCELED,
    ];

    if (user.role === UserRole.CLIENT) {
      const client = await this.prisma.client.findUnique({
        where: { userId: user.id },
      });

      if (!client) {
        throw new NotFoundException('Client profile not found for this user');
      }

      if (order.clientId !== client.id) {
        throw new ForbiddenException(
          'Clients can only modify their own orders',
        );
      }

      if (!clientAllowedStatuses.includes(dto.status)) {
        throw new ForbiddenException('Clients cannot set this status');
      }
    }

    if (
      user.role === UserRole.ADMIN &&
      ![...adminOnlyStatuses, ...clientAllowedStatuses].includes(dto.status)
    ) {
      throw new BadRequestException('Invalid status value');
    }

    if (dto.status === OrderStatus.PREPARING) {
      const items = await this.prisma.orderItem.findMany({
        where: { orderId: id },
      });

      await Promise.all(
        items.map(async (item) => {
          const product = await this.prisma.product.findUnique({
            where: { id: item.productId },
          });
          if (!product)
            throw new NotFoundException(`Product ${item.productId} not found`);
          if (product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${product.name}`,
            );
          }
          await this.prisma.product.update({
            where: { id: product.id },
            data: { stock: product.stock - item.quantity },
          });
        }),
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: { items: true },
    });
  }

  async remove(id: number, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete orders');
    }

    return this.prisma.order.delete({ where: { id } });
  }
}
