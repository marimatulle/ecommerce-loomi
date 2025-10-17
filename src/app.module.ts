import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [AuthModule, ClientsModule, ProductsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
