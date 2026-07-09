import { PaginatedResponseDto, PaginationMeta } from '../dto/response.dto';

/**
 * Builds a PaginatedResponseDto from a rows/count pair (e.g. TypeORM findAndCount).
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
  return new PaginatedResponseDto<T>(data, meta);
}
