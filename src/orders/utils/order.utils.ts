import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { Prisma, UserRole } from '@prisma/client';
import DecimalJS from 'decimal.js';

export function calculateTotal(
  items: { productId: number; quantity: number }[],
  products: any[],
) {
  let total = new DecimalJS(0);
  const orderItems: Prisma.OrderItemCreateManyOrderInput[] = items.map(
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

  return { total: total.toNumber(), orderItems };
}

export async function getClient(
  prisma: PrismaService,
  user: AuthenticatedUser,
) {
  if (user.role !== UserRole.CLIENT)
    throw new ForbiddenException('Only clients can access this');

  const client = await prisma.client.findUnique({
    where: { userId: user.id },
  });
  if (!client) throw new NotFoundException('Client profile not found');

  return client;
}

export async function recalculateCartTotal(
  prisma: PrismaService,
  orderId: number,
) {
  const items = await prisma.orderItem.findMany({
    where: { orderId: orderId },
  });

  const total = items
    .reduce(
      (acc, i) => acc.plus(new DecimalJS(i.subtotal.toString())),
      new DecimalJS(0),
    )
    .toNumber();

  await prisma.order.update({
    where: { id: orderId },
    data: { total },
  });
}
