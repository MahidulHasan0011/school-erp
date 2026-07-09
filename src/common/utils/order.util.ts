/**
 * Normalizes an arbitrary sort direction string to a valid TypeORM order value.
 */
export function normalizeOrder(order?: string): 'ASC' | 'DESC' {
  return String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
}

/**
 * Guards against SQL injection via user-supplied sort columns by allow-listing.
 */
export function safeSortColumn(
  sortBy: string | undefined,
  allowed: string[],
  fallback: string,
): string {
  if (sortBy && allowed.includes(sortBy)) {
    return sortBy;
  }
  return fallback;
}
