import { Injectable } from '@nestjs/common';

/**
 * Resolves the effective permission set for a user given their roles.
 * Kept framework-free so it can be unit-tested and reused by guards/services.
 */
@Injectable()
export class PermissionEngine {
  /**
   * Flattens role -> permissions maps into a unique permission set.
   */
  resolve(
    userRoles: string[],
    rolePermissions: Record<string, string[]>,
  ): string[] {
    const set = new Set<string>();
    for (const role of userRoles) {
      for (const perm of rolePermissions[role] ?? []) {
        set.add(perm);
      }
    }
    return [...set];
  }

  /** True if the granted set satisfies every required permission. */
  can(granted: string[], required: string[]): boolean {
    const set = new Set(granted);
    return required.every((p) => set.has(p));
  }
}
