import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignRolePermissionDto {
  @ApiProperty({ description: 'Role UUID' })
  @IsUUID()
  roleId: string;

  @ApiProperty({ description: 'Permission UUID' })
  @IsUUID()
  permissionId: string;
}
