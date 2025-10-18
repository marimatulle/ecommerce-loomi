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
import { OrderStatus, UserRole } from '@prisma/client';
import DecimalJS from 'decimal.js';
import {
  calculateTotal,
  getClient,
  recalculateCartTotal,
} from '../utils/order.utils';

const PAGE_SIZE = 20;

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto, user: AuthenticatedUser) {
    const client = await getClient(this.prisma, user);

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });

    if (products.length !== dto.items.length)
      throw new NotFoundException('Some products not found');

    const { total, orderItems } = calculateTotal(dto.items, products);

    const order = await this.prisma.order.create({
      data: {
        clientId: client.id,
        total,
        status: OrderStatus.ORDERED,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    return order;
  }

  async findAll(user: AuthenticatedUser, page: number = 1) {
    const skip = (page - 1) * PAGE_SIZE;

    let whereClause = {};

    if (user.role === UserRole.CLIENT) {
      const client = await getClient(this.prisma, user);
      whereClause = { clientId: client.id };
    }

    const totalCount = await this.prisma.order.count({ where: whereClause });

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      skip,
      take: PAGE_SIZE,
      orderBy: { id: 'asc' },
      include: {
        items: true,
        ...(user.role === UserRole.ADMIN ? { client: true } : {}),
      },
    });

    return {
      data: orders,
      meta: {
        totalItems: totalCount,
        itemCount: orders.length,
        itemsPerPage: PAGE_SIZE,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
        currentPage: page,
      },
    };
  }

  async findOne(id: number, user?: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (user?.role === UserRole.CLIENT) {
      const client = await getClient(this.prisma, user);
      if (order.clientId !== client.id)
        throw new ForbiddenException('Cannot access other client orders');
    }

    return order;
  }

  async update(id: number, dto: UpdateOrderDto, user: AuthenticatedUser) {
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
      if (!clientAllowedStatuses.includes(dto.status))
        throw new ForbiddenException('Clients cannot set this status');
    }

    if (user.role === UserRole.ADMIN) {
      if (
        ![...adminOnlyStatuses, ...clientAllowedStatuses].includes(dto.status)
      )
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
          if (product.stock < item.quantity)
            throw new BadRequestException(
              `Insufficient stock for product ${product.name}`,
            );
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
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Only admins can delete orders');

    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.order.delete({ where: { id } });
  }

  async addToCart(dto: CreateOrderDto, user: AuthenticatedUser) {
    const client = await getClient(this.prisma, user);

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== dto.items.length)
      throw new NotFoundException('Some products not found');

    dto.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      if (item.quantity > product.stock)
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}`,
        );
    });

    const cart = await this.prisma.order.findFirst({
      where: { clientId: client.id, status: OrderStatus.CART },
      include: { items: true },
    });

    let cartId: number;

    if (!cart) {
      const { total, orderItems } = calculateTotal(dto.items, products);

      const newCart = await this.prisma.order.create({
        data: {
          clientId: client.id,
          total,
          status: OrderStatus.CART,
          items: { create: orderItems },
        },
        include: { items: true },
      });

      cartId = newCart.id;
    } else {
      cartId = cart.id;

      await Promise.all(
        dto.items.map(async (newItem) => {
          const existingItem = cart.items.find(
            (i) => i.productId === newItem.productId,
          );
          const product = products.find((p) => p.id === newItem.productId)!;

          const unitPrice = new DecimalJS(product.price.toString()).toNumber();
          const quantityToAdd = newItem.quantity;
          const currentQuantity = existingItem?.quantity || 0;
          const newQuantity = currentQuantity + quantityToAdd;
          const newSubtotal = new DecimalJS(newQuantity)
            .times(unitPrice)
            .toNumber();

          if (existingItem) {
            await this.prisma.orderItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: newQuantity,
                subtotal: newSubtotal,
              },
            });
          } else {
            await this.prisma.orderItem.create({
              data: {
                orderId: cartId,
                productId: newItem.productId,
                quantity: quantityToAdd,
                unitPrice: unitPrice,
                subtotal: new DecimalJS(quantityToAdd)
                  .times(unitPrice)
                  .toNumber(),
              },
            });
          }
        }),
      );

      await recalculateCartTotal(this.prisma, cartId);
    }

    return this.getCart(user);
  }

  async removeFromCart(
    productId: number,
    user: AuthenticatedUser,
    quantityToRemove: number = 1,
  ) {
    const cart = await this.getCart(user);
    if (!cart) throw new NotFoundException('Cart not found');

    if (quantityToRemove <= 0) {
      throw new BadRequestException(
        'Quantity to remove must be greater than zero',
      );
    }

    const item = await this.prisma.orderItem.findFirst({
      where: { orderId: cart.id, productId },
    });

    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }

    const currentQuantity = item.quantity;
    const newQuantity = currentQuantity - quantityToRemove;

    if (newQuantity <= 0) {
      await this.prisma.orderItem.delete({ where: { id: item.id } });
    } else {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new NotFoundException('Product not found');
      const unitPrice = new DecimalJS(product.price.toString()).toNumber();
      const newSubtotal = new DecimalJS(newQuantity)
        .times(unitPrice)
        .toNumber();

      await this.prisma.orderItem.update({
        where: { id: item.id },
        data: {
          quantity: newQuantity,
          subtotal: newSubtotal,
        },
      });
    }

    await recalculateCartTotal(this.prisma, cart.id);

    const remainingItemsCount = await this.prisma.orderItem.count({
      where: { orderId: cart.id },
    });

    if (remainingItemsCount === 0) {
      await this.prisma.order.delete({ where: { id: cart.id } });

      return {
        statusCode: 200,
        message:
          'Item removed successfully. Cart is now empty and has been deleted.',
        cart: null,
      };
    }

    return this.getCart(user);
  }

  async checkout(user: AuthenticatedUser) {
    const cart = await this.getCart(user);

    let finishedOrder;

    await this.prisma.$transaction(async (prisma) => {
      await Promise.all(
        cart.items.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });
          if (!product)
            throw new NotFoundException(`Product ${item.productId} not found`);
          if (product.stock < item.quantity)
            throw new BadRequestException(
              `Insufficient stock for product ${product.name}`,
            );
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: product.stock - item.quantity },
          });
        }),
      );

      finishedOrder = await prisma.order.update({
        where: { id: cart.id },
        data: { status: OrderStatus.ORDERED },
        include: { items: true },
      });
    });

    return finishedOrder;
  }

  async getCart(user: AuthenticatedUser) {
    const client = await getClient(this.prisma, user);

    const cart = await this.prisma.order.findFirst({
      where: {
        clientId: client.id,
        status: OrderStatus.CART,
      },
      include: { items: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }
}
