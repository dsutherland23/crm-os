import {
  IsUUID, IsInt, IsArray, IsOptional, IsString, IsIn, Min, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PosTransactionItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  discountCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  totalCents!: number;
}

export class CreatePosTransactionDto {
  /** Client-generated UUIDv7 for offline idempotency */
  @ApiProperty({ description: 'Client-generated UUIDv7 for offline deduplication' })
  @IsUUID()
  offlineId!: string;

  @ApiProperty()
  @IsUUID()
  posSessionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  subtotalCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  taxCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  discountCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  totalCents!: number;

  @ApiProperty({ enum: ['cash', 'card', 'mixed', 'digital'] })
  @IsIn(['cash', 'card', 'mixed', 'digital'])
  paymentMethod!: string;

  @ApiProperty({ type: [PosTransactionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosTransactionItemDto)
  items!: PosTransactionItemDto[];
}
