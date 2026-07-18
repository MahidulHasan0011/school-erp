import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLog } from './entities/error-log.entity';
import { ErrorLogsController } from './error-logs.controller';
import { ErrorLogsRepository } from './error-logs.repository';
import { ErrorLogsService } from './error-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErrorLog])],
  controllers: [ErrorLogsController],
  providers: [ErrorLogsService, ErrorLogsRepository],
  exports: [ErrorLogsService, ErrorLogsRepository],
})
export class ErrorLogsModule {}
