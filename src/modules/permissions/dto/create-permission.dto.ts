import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'STUDENT_CREATE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
