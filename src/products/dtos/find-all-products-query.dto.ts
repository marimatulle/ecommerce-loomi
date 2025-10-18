import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  IsString,
  IsNumber,
  IsBoolean,
  IsPositive,
  Min,
} from 'class-validator';

export class FindAllProductsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination (page 1 by default).',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  page: number = 1;

  @ApiPropertyOptional({
    description:
      'Text to search in the product name (case-insensitive search).',
    example: 'Keyboard',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Minimum price for the product filter.',
    example: 10.0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum price for the product filter.',
    example: 1000.0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  maxPrice?: number;

  @ApiPropertyOptional({
    description:
      'Filter by stock availability. "true" returns products with stock > 0. "false" returns products with stock = 0.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  available?: boolean;
}
