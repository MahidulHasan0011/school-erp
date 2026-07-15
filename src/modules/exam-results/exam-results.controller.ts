import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BulkCreateExamResultDto } from './dto/bulk-create-exam-result.dto';
import { CreateExamResultDto } from './dto/create-exam-result.dto';
import { QueryExamResultsDto } from './dto/query-exam-results.dto';
import { UpdateExamResultDto } from './dto/update-exam-result.dto';
import { ExamResultsService } from './exam-results.service';

@ApiTags('exam-results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('exam-results')
export class ExamResultsController {
  constructor(private readonly resultsService: ExamResultsService) {}

  @Get()
  @Permissions('EXAM_RESULT_READ')
  @ApiOperation({ summary: 'সব result (paginated + filter)' })
  findAll(@Query() query: QueryExamResultsDto) {
    return this.resultsService.findAll(query);
  }

  // ⚠️ নির্দিষ্ট path গুলো '/:id'-এর আগে
  @Get('exam/:examId')
  @Permissions('EXAM_RESULT_READ')
  @ApiOperation({ summary: 'একটি exam-এর সব result' })
  getByExam(@Param('examId', ParseUUIDPipe) examId: string) {
    return this.resultsService.getByExam(examId);
  }

  @Get('exam/:examId/student/:studentId/marksheet')
  @Permissions('EXAM_RESULT_READ')
  @ApiOperation({ summary: 'একজন student-এর marksheet (এক exam)' })
  getMarksheet(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.resultsService.getMarksheet(examId, studentId);
  }

  @Get(':id')
  @Permissions('EXAM_RESULT_READ')
  @ApiOperation({ summary: 'একটি result' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.resultsService.findOne(id);
  }

  @Post()
  @Permissions('EXAM_RESULT_CREATE')
  @ApiOperation({ summary: 'একটি result entry' })
  create(@Body() dto: CreateExamResultDto) {
    return this.resultsService.create(dto);
  }

  @Post('bulk')
  @Permissions('EXAM_RESULT_CREATE')
  @ApiOperation({ summary: 'bulk result entry (এক exam, অনেক student/subject)' })
  bulkCreate(@Body() dto: BulkCreateExamResultDto) {
    return this.resultsService.bulkCreate(dto);
  }

  @Patch(':id')
  @Permissions('EXAM_RESULT_UPDATE')
  @ApiOperation({ summary: 'result-এর marks আপডেট' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamResultDto,
  ) {
    return this.resultsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('EXAM_RESULT_UPDATE')
  @ApiOperation({ summary: 'result মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.resultsService.remove(id);
  }
}