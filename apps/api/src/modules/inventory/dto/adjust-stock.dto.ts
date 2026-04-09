import { IsInt, IsString, IsUUID, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CHANGE_TYPES = ['restock', 'adjustment', 'damage', 'transfer'] as const;

export class AdjustStockDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  locationId!: string;

  @ApiProperty({ description: 'Positive = add, negative = remove' })
  @IsInt()
  delta!: number;

  @ApiProperty({ enum: CHANGE_TYPES })
  @IsIn(CHANGE_TYPES)
  changeType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  referenceId?: string;
}
