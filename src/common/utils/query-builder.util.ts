import { SelectQueryBuilder } from 'typeorm';

/**
 * Applies ILIKE search across the given columns to a TypeORM query builder.
 */
export function applySearch<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  columns: string[],
  search?: string,
): SelectQueryBuilder<T> {
  if (!search || columns.length === 0) {
    return qb;
  }
  const clause = columns
    .map((col) => `${alias}.${col} ILIKE :search`)
    .join(' OR ');
  return qb.andWhere(`(${clause})`, { search: `%${search}%` });
}

/**
 * Applies ORDER BY + LIMIT/OFFSET to a query builder.
 */
export function applyPagination<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  opts: { skip: number; limit: number; sortBy?: string; order?: 'ASC' | 'DESC' },
): SelectQueryBuilder<T> {
  if (opts.sortBy) {
    qb.orderBy(`${alias}.${opts.sortBy}`, opts.order ?? 'DESC');
  }
  return qb.skip(opts.skip).take(opts.limit);
}
