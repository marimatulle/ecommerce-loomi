import { Module } from '@nestjs/common';
import { ProductsService } from './service/products.service';
import { ProductsController } from './controller/products.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService],
})
export class ProductsModule {}
