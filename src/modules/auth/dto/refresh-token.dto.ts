import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'login/refresh থেকে পাওয়া refresh token' })
  @IsNotEmpty()
  @IsJWT()
  refreshToken: string;
}
