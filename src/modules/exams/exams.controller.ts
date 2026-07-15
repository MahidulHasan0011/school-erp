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
import { CreateExamDto } from './dto/create-exam.dto';
import { QueryExamsDto } from './dto/query-exams.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamsService } from './exams.service';

@ApiTags('exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  @Permissions('EXAM_READ')
  @ApiOperation({ summary: 'সব exam (paginated + filter)' })
  findAll(@Query() query: QueryExamsDto) {
    return this.examsService.findAll(query);
  }

  @Get(':id')
  @Permissions('EXAM_READ')
  @ApiOperation({ summary: 'একটি exam' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.examsService.findOne(id);
  }

  @Post()
  @Permissions('EXAM_CREATE')
  @ApiOperation({ summary: 'নতুন exam তৈরি' })
  create(@Body() dto: CreateExamDto) {
    return this.examsService.create(dto);
  }

  @Patch(':id')
  @Permissions('EXAM_UPDATE')
  @ApiOperation({ summary: 'exam আপডেট' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExamDto) {
    return this.examsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('EXAM_DELETE')
  @ApiOperation({ summary: 'exam মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.examsService.remove(id);
  }

  @Patch(':id/publish')
  @Permissions('EXAM_UPDATE')
  @ApiOperation({ summary: 'exam publish (result গণনায় আসবে)' })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.examsService.publish(id);
  }

  @Patch(':id/unpublish')
  @Permissions('EXAM_UPDATE')
  @ApiOperation({ summary: 'exam unpublish (DRAFT-এ ফেরত)' })
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.examsService.unpublish(id);
  }
}
