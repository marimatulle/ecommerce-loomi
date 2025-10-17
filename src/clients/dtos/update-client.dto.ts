import { PartialType } from '@nestjs/mapped-types';
import { CreateClientDto } from './create-client.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @ApiPropertyOptional({
    description:
      'Client status (active = true / inactive = false) true by default',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
