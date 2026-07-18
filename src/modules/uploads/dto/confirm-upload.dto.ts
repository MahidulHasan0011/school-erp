import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty({ description: 'generate-url থেকে পাওয়া upload id' })
  @IsUUID()
  id: string;
}
