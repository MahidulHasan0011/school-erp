import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const ROLES_KEY = 'roles';

/**
 * Attaches required permissions to a route, read by PermissionsGuard.
 * Usage: `@Permissions('student.create', 'student.update')`
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Attaches required roles to a route, read by RolesGuard.
 * Usage: `@Roles('admin', 'teacher')`
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
