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
  ParseIntPipe,
  Query,
  HttpCode,
  UsePipes,
} from '@nestjs/common';
import { OrdersService } from '../service/orders.service';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { UpdateOrderDto } from '../dtos/update-order.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { Request as ExpressRequest } from 'express';
import { FindAllOrdersQueryDto } from '../dtos/find-all-orders-query.dto';
import { SanitizationPipe } from 'src/pipes/sanization.pipe';

interface AuthenticatedRequest extends ExpressRequest {
  user: AuthenticatedUser;
}

@ApiTags('Order')
@ApiBearerAuth()
@UsePipes(SanitizationPipe)
@UseGuards(AuthGuard, RolesGuard)
@Controller('order')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('CLIENT')
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto, req.user);
  }

  @Get()
  @Roles('ADMIN', 'CLIENT')
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: FindAllOrdersQueryDto,
  ) {
    return this.ordersService.findAll(req.user, query);
  }

  @Get('cart')
  @Roles('CLIENT')
  getCart(@Request() req: AuthenticatedRequest) {
    return this.ordersService.getCart(req.user);
  }

  @Post('cart')
  @Roles('CLIENT')
  addToCart(@Request() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.addToCart(dto, req.user);
  }

  @Post('cart/checkout')
  @Roles('CLIENT')
  checkout(@Request() req: AuthenticatedRequest) {
    return this.ordersService.checkout(req.user);
  }

  @Delete('cart/:productId')
  @Roles('CLIENT')
  @HttpCode(200)
  removeFromCart(
    @Param('productId', ParseIntPipe) productId: number,
    @Request() req: AuthenticatedRequest,
    @Query('quantity', new ParseIntPipe({ optional: true }))
    quantityToRemove?: number,
  ) {
    return this.ordersService.removeFromCart(
      productId,
      req.user,
      quantityToRemove,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'CLIENT')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ordersService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'CLIENT')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ordersService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ordersService.remove(id, req.user);
  }
}
