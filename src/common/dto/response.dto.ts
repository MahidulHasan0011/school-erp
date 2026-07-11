import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard envelope returned by ResponseInterceptor for successful requests.
 */
export class ResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'OK' })
  message: string;

  data: T;

  constructor(partial: Partial<ResponseDto<T>>) {
    Object.assign(this, partial);
  }
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMeta;

  constructor(data: T[], meta: PaginationMeta) {
    this.data = data;
    this.meta = meta;
  }
}
