import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Admin কর্তৃক অন্য user-এর পাসওয়ার্ড reset — পুরনো পাসওয়ার্ড লাগে না। */
export class ResetPasswordDto {
  @ApiProperty({ example: 'NewP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
