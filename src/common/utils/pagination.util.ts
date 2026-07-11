import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto, PaginationMeta } from '../dto/response.dto';

/**
 * Normalizes raw pagination query params into safe page/limit/skip values.
 */
export function getPagination(query: PaginationDto) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Builds a PaginatedResponseDto from a rows/count pair (e.g. TypeORM findAndCount).
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
  return new PaginatedResponseDto<T>(data, meta);
}
