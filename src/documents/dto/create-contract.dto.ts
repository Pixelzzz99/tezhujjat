import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
} from 'class-validator';

// Поля, которые пользователь вводит на форме под конкретную сделку.
// Реквизиты исполнителя (executor*) в реальной версии подтягиваются из Profile по userId —
// здесь оставлены в DTO, чтобы эндпоинт можно было проверить без Auth-контекста на MVP-этапе.
export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsOptional()
  clientInn?: string;

  @IsString()
  @IsOptional()
  clientAddress?: string;

  @IsString()
  @IsNotEmpty()
  serviceDescription: string;

  @IsString()
  @IsNotEmpty()
  startDate: string; // формат: 01.09.2026

  @IsString()
  @IsNotEmpty()
  endDate: string;

  @IsNumberString()
  amount: string;

  @IsString()
  @IsOptional()
  currency?: string = 'UZS';

  @IsString()
  @IsOptional()
  paymentTerms?: string =
    'в течение 5 (пяти) банковских дней с момента подписания Акта выполненных работ';

  @IsString()
  @IsOptional()
  contractCity?: string = 'Ташкент';
}
