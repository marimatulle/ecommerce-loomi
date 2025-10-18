import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientDto } from '../dtos/create-client.dto';
import { UpdateClientDto } from '../dtos/update-client.dto';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

const PAGE_SIZE = 20;

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, dto: CreateClientDto) {
    const existingClient = await this.prisma.client.findUnique({
      where: { userId },
    });
    if (existingClient)
      throw new ConflictException('Client already exists for this user');

    return this.prisma.client.create({
      data: { ...dto, userId },
    });
  }

  async findAll(page: number = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const totalCount = await this.prisma.client.count();
    const clients = await this.prisma.client.findMany({
      skip,
      take: PAGE_SIZE,
      include: { user: { select: { email: true, role: true } } },
      orderBy: { id: 'asc' },
    });
    return {
      data: clients,
      meta: {
        totalItems: totalCount,
        itemCount: clients.length,
        itemsPerPage: PAGE_SIZE,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
        currentPage: page,
      },
    };
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client not found');

    if (user.role !== 'ADMIN' && client.userId !== user.id) {
      throw new ForbiddenException("You don't have access to this client");
    }

    return client;
  }

  async update(id: number, dto: UpdateClientDto, user: AuthenticatedUser) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client not found');

    if (user.role !== 'ADMIN' && client.userId !== user.id) {
      throw new ForbiddenException(
        "You don't have access to update this client",
      );
    }

    if (user.role !== 'ADMIN') {
      delete dto.status;
    }

    return this.prisma.client.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client not found.');

    return this.prisma.client.delete({ where: { id } });
  }
}
