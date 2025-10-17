import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({
    description: 'Client full name',
    example: 'Maria Silva',
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'Telephone contact or email address',
    example: '+55 11 99999-9999',
  })
  @IsNotEmpty()
  @IsString()
  contact: string;

  @ApiProperty({
    description: 'Client address',
    example: 'Rua das Flores, 123, São Paulo, SP',
  })
  @IsNotEmpty()
  @IsNotEmpty()
  @IsString()
  address: string;
}
