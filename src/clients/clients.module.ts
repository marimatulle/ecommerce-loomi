import { Module } from '@nestjs/common';
import { ClientsService } from './service/clients.service';
import { ClientsController } from './controller/clients.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, PrismaService],
})
export class ClientsModule {}
