import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsInt, IsEnum, IsISO8601, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class FindAllOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination (page 1 by default).',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Filter orders by status.',
    enum: OrderStatus,
    example: OrderStatus.ORDERED,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description:
      'Filter orders created after this date (ISO 8601 format: YYYY-MM-DD).',
    example: '2023-10-01',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'Filter orders created before this date (ISO 8601 format: YYYY-MM-DD).',
    example: '2023-10-31',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string;
}
