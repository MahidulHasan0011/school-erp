import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({ example: 'Class 6' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
