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
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductsService } from '../service/products.service';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: AuthenticatedUser;
}

@ApiTags('Product')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('product')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN')
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateProductDto) {
    return this.productsService.create(dto, req.user);
  }

  @Get()
  @Roles('ADMIN', 'CLIENT')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description:
      'Page number for list endpoints (page 1 by default, 20 items per page).',
  })
  findAll(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.productsService.findAll(page);
  }

  @Get(':id')
  @Roles('ADMIN', 'CLIENT')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.productsService.update(+id, dto, req.user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.productsService.remove(+id, req.user);
  }
}
