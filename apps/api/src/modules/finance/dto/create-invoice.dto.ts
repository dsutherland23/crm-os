import { IsInt, IsString, IsOptional, IsUUID, IsIn, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ description: 'Subtotal in cents' })
  @IsInt()
  @Min(0)
  subtotalCents!: number;

  @ApiProperty({ description: 'Tax amount in cents' })
  @IsInt()
  @Min(0)
  taxCents!: number;

  @ApiProperty({ description: 'Discount amount in cents' })
  @IsInt()
  @Min(0)
  discountCents!: number;

  @ApiProperty({ description: 'Total in cents' })
  @IsInt()
  @Min(0)
  totalCents!: number;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  @IsIn(['EUR', 'USD', 'GBP', 'JMD'])
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
