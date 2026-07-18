import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RankingLocksService } from './ranking-locks.service';

@ApiTags('ranking-locks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ranking-locks')
export class RankingLocksController {
  constructor(private readonly rankingLocksService: RankingLocksService) {}

  // lock/unlock action ranking module-এ (POST /ranking/unlock, generate-roll
  // auto-lock)। এখানে শুধু status দেখা যায়।
  @Get(':classId/:academicSessionId')
  @Permissions('RANKING_READ')
  @ApiOperation({ summary: 'class+session-এর ranking lock status' })
  getStatus(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('academicSessionId', ParseUUIDPipe) academicSessionId: string,
  ) {
    return this.rankingLocksService.getStatus(classId, academicSessionId);
  }
}
