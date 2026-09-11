import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ClientType } from '@prisma/client';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ClientType)
  @IsOptional()
  type?: ClientType;

  @IsString()
  @IsOptional()
  inn?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
