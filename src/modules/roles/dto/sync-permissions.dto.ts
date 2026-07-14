import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

/**
 * Replaces a role's entire permission set with the given list.
 * An empty array strips all permissions from the role.
 */
export class SyncPermissionsDto {
  @ApiProperty({
    type: [String],
    description: 'Permission UUIDs to assign to the role',
    example: ['10000000-0000-0000-0000-000000000005'],
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  permissionIds: string[];
}
