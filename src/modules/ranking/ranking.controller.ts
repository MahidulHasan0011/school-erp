import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { GenerateRollDto } from './dto/generate-roll.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { RecalculateDto } from './dto/recalculate.dto';
import { UnlockDto } from './dto/unlock.dto';
import { RankingService } from './ranking.service';

@ApiTags('ranking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  // ── write (background job — 202 Accepted) ──
  @Post('generate-roll')
  @HttpCode(202)
  @Permissions('RANKING_GENERATE')
  @ApiOperation({ summary: 'roll + rank generate — queue-তে পাঠায় (202)' })
  generateRoll(
    @Body() dto: GenerateRollDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.rankingService.requestGenerate(dto, userId);
  }

  @Post('recalculate')
  @HttpCode(202)
  @Permissions('RANKING_RECALCULATE')
  @ApiOperation({ summary: 'recalculate — unlock করে queue-তে পাঠায় (202)' })
  recalculate(@Body() dto: RecalculateDto, @CurrentUser('id') userId: string) {
    return this.rankingService.requestRecalculate(dto, userId);
  }

  @Post('unlock')
  @Permissions('RANKING_UNLOCK')
  @ApiOperation({ summary: 'ranking unlock (regenerate ছাড়া)' })
  unlock(@Body() dto: UnlockDto, @CurrentUser('id') userId: string) {
    return this.rankingService.unlock(
      dto.classId,
      dto.academicSessionId,
      userId,
    );
  }

  // ── read ──
  @Get(':classId/:academicSessionId')
  @Permissions('RANKING_READ')
  @ApiOperation({ summary: 'current ranking (সর্বশেষ version)' })
  getRanking(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('academicSessionId', ParseUUIDPipe) academicSessionId: string,
  ) {
    return this.rankingService.getRanking(classId, academicSessionId);
  }

  @Get(':classId/:academicSessionId/history')
  @Permissions('RANKING_READ')
  @ApiOperation({ summary: 'version list বা নির্দিষ্ট version snapshot' })
  getHistory(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('academicSessionId', ParseUUIDPipe) academicSessionId: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.rankingService.getHistory(classId, academicSessionId, query);
  }

  @Get(':classId/:academicSessionId/audit')
  @Permissions('RANKING_READ')
  @ApiOperation({ summary: 'ranking audit log' })
  getAuditLog(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('academicSessionId', ParseUUIDPipe) academicSessionId: string,
  ) {
    return this.rankingService.getAuditLog(classId, academicSessionId);
  }

  @Get(':classId/:academicSessionId/job-status')
  @Permissions('RANKING_READ')
  @ApiOperation({ summary: 'সর্বশেষ ranking job-এর status (queued/processing/…)' })
  getJobStatus(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('academicSessionId', ParseUUIDPipe) academicSessionId: string,
  ) {
    return this.rankingService.getJobStatus(classId, academicSessionId);
  }

  // ── DLQ (parking lot) — admin ──
  @Get('dlq')
  @Permissions('RANKING_ADMIN')
  @ApiOperation({
    summary: 'DLQ-তে পার্ক হওয়া ব্যর্থ job দেখা (non-destructive peek)',
  })
  getDeadLetters() {
    return this.rankingService.getDeadLetters();
  }

  @Post('dlq/replay')
  @HttpCode(200)
  @Permissions('RANKING_ADMIN')
  @ApiOperation({
    summary: 'DLQ-এর job আবার main queue-তে ফেরত পাঠানো (attempts reset)',
  })
  replayDeadLetters() {
    return this.rankingService.replayDeadLetters();
  }
}
