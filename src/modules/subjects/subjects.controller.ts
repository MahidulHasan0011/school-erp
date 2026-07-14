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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectsService } from './subjects.service';

@ApiTags('subjects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @Permissions('SUBJECT_READ')
  @ApiOperation({ summary: 'সব subject (paginated)' })
  findAll(@Query() query: PaginationDto) {
    return this.subjectsService.findAll(query);
  }

  @Get(':id')
  @Permissions('SUBJECT_READ')
  @ApiOperation({ summary: 'একটি subject' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.findOne(id);
  }

  @Post()
  @Permissions('SUBJECT_CREATE')
  @ApiOperation({ summary: 'নতুন subject তৈরি' })
  create(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(dto);
  }

  @Patch(':id')
  @Permissions('SUBJECT_UPDATE')
  @ApiOperation({ summary: 'subject আপডেট' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('SUBJECT_DELETE')
  @ApiOperation({ summary: 'subject মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.remove(id);
  }
}
