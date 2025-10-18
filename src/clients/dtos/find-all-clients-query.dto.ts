import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsInt, Min, IsString, IsBoolean } from 'class-validator';

export class FindAllClientsQueryDto {
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
    description:
      'Filter clients by full name (partial match, case-insensitive).',
    example: 'Maria',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description:
      'Filter clients by user email (partial match, case-insensitive).',
    example: 'teste@email',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Filter clients by status (true for active, false for inactive).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  status?: boolean;
}
