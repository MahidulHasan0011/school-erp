import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { QueryErrorLogsDto } from './dto/query-error-logs.dto';
import { ErrorLog } from './entities/error-log.entity';
import { ErrorLogsRepository } from './error-logs.repository';

@Injectable()
export class ErrorLogsService {
  constructor(private readonly errorLogsRepository: ErrorLogsRepository) {}

  async findAll(query: QueryErrorLogsDto) {
    const [data, total] = await this.errorLogsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<ErrorLog> {
    const log = await this.errorLogsRepository.findById(id);
    if (!log) {
      throw new NotFoundException('Error log not found');
    }
    return log;
  }

  async remove(id: string): Promise<{ message: string }> {
    const log = await this.findOne(id);
    await this.errorLogsRepository.remove(log);
    return { message: 'Error log deleted successfully' };
  }

  async clear(): Promise<{ message: string; deleted: number }> {
    const deleted = await this.errorLogsRepository.clearAll();
    return { message: 'Error logs cleared', deleted };
  }
}
