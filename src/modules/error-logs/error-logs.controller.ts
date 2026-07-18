import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { QueryErrorLogsDto } from './dto/query-error-logs.dto';
import { ErrorLogsService } from './error-logs.service';

@ApiTags('error-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('error-logs')
export class ErrorLogsController {
  constructor(private readonly errorLogsService: ErrorLogsService) {}

  @Get()
  @Permissions('ERROR_LOG_READ')
  @ApiOperation({ summary: 'সব error log (paginated + filter/search)' })
  findAll(@Query() query: QueryErrorLogsDto) {
    return this.errorLogsService.findAll(query);
  }

  @Get(':id')
  @Permissions('ERROR_LOG_READ')
  @ApiOperation({ summary: 'একটি error log' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.errorLogsService.findOne(id);
  }

  @Delete()
  @Permissions('ERROR_LOG_DELETE')
  @ApiOperation({ summary: 'সব error log মুছে ফেলা (clear)' })
  clear() {
    return this.errorLogsService.clear();
  }

  @Delete(':id')
  @Permissions('ERROR_LOG_DELETE')
  @ApiOperation({ summary: 'একটি error log মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.errorLogsService.remove(id);
  }
}
