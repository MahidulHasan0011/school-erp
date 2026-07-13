import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** নিজের পাসওয়ার্ড বদলানো — পুরনো পাসওয়ার্ড যাচাই করে। */
export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ss123' })
  @IsString()
  @MinLength(8)
  oldPassword: string;

  @ApiProperty({ example: 'NewP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
