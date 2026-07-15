import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

// শুধু marks আপডেট করা যায় (grade স্বয়ংক্রিয় হিসাব হয়) — original logic অনুযায়ী
export class UpdateExamResultDto {
  @ApiProperty({ example: 90, minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  marks: number;
}