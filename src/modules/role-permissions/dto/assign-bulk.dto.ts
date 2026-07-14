import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignBulkDto {
  @ApiProperty({ description: 'Role UUID' })
  @IsUUID()
  roleId: string;

  @ApiProperty({
    type: [String],
    description: 'Permission UUIDs to attach to the role',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  permissionIds: string[];
}
