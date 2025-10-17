import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ClientsService } from '../service/clients.service';
import { CreateClientDto } from '../dtos/create-client.dto';
import { UpdateClientDto } from '../dtos/update-client.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: AuthenticatedUser;
}

@ApiTags('Client')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('client')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles('CLIENT')
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateClientDto) {
    return this.clientsService.create(req.user.id, dto);
  }

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'CLIENT')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.clientsService.findOne(+id, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'CLIENT')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.clientsService.update(+id, dto, req.user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(+id);
  }
}
