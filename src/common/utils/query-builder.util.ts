import { SelectQueryBuilder } from 'typeorm';

/**
 * Applies ILIKE search across the given columns to a TypeORM query builder.
 *
 * Columns are prefixed with `alias` by default, but a column that already
 * contains a `.` is treated as fully-qualified and used as-is — so a search
 * can span joined relations, e.g. `['studentCode', 'user.fullName']`.
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
    .map((col) => (col.includes('.') ? col : `${alias}.${col}`))
    .map((qualified) => `${qualified} ILIKE :search`)
    .join(' OR ');
  return qb.andWhere(`(${clause})`, { search: `%${search}%` });
}

/**
 * Applies equality / IN filters to a query builder.
 *
 * - `undefined` and `null` values are skipped (so optional query params are ignored).
 * - Array values become an `IN (...)` clause.
 * - Everything else becomes an `= ` equality clause.
 *
 * Column keys are prefixed with a unique parameter name to avoid collisions.
 */
export function applyFilters<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  filters: Record<string, unknown>,
): SelectQueryBuilder<T> {
  Object.entries(filters).forEach(([column, value], index) => {
    if (value === undefined || value === null) {
      return;
    }
    const param = `filter_${column}_${index}`;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }
      qb.andWhere(`${alias}.${column} IN (:...${param})`, { [param]: value });
    } else {
      qb.andWhere(`${alias}.${column} = :${param}`, { [param]: value });
    }
  });
  return qb;
}

/**
 * Applies ORDER BY + LIMIT/OFFSET to a query builder.
 */
export function applyPagination<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  opts: {
    skip: number;
    limit: number;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
  },
): SelectQueryBuilder<T> {
  if (opts.sortBy) {
    qb.orderBy(`${alias}.${opts.sortBy}`, opts.order ?? 'DESC');
  }
  return qb.skip(opts.skip).take(opts.limit);
}
