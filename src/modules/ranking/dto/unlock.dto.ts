import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UnlockDto {
  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiProperty({ description: 'Academic session UUID' })
  @IsUUID()
  academicSessionId: string;
}
