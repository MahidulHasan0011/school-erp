import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GenerateRollDto {
  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiProperty({ description: 'Academic session UUID' })
  @IsUUID()
  academicSessionId: string;

  @ApiPropertyOptional({
    description: 'নির্দিষ্ট section — না দিলে ক্লাসের সব section-এ distribute হয়',
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;
}
