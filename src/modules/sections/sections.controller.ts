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
import { CreateSectionDto } from './dto/create-section.dto';
import { QuerySectionsDto } from './dto/query-sections.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionsService } from './sections.service';

@ApiTags('sections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  @Permissions('SECTION_READ')
  @ApiOperation({ summary: 'সব section (paginated, classId filter)' })
  findAll(@Query() query: QuerySectionsDto) {
    return this.sectionsService.findAll(query);
  }

  @Get(':id')
  @Permissions('SECTION_READ')
  @ApiOperation({ summary: 'একটি section' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectionsService.findOne(id);
  }

  @Get(':id/occupancy')
  @Permissions('SECTION_READ')
  @ApiOperation({ summary: 'section-এর ধারণক্ষমতা vs ভর্তি সংখ্যা' })
  getOccupancy(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectionsService.getOccupancy(id);
  }

  @Post()
  @Permissions('SECTION_CREATE')
  @ApiOperation({ summary: 'নতুন section তৈরি' })
  create(@Body() dto: CreateSectionDto) {
    return this.sectionsService.create(dto);
  }

  @Patch(':id')
  @Permissions('SECTION_UPDATE')
  @ApiOperation({ summary: 'section আপডেট' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('SECTION_DELETE')
  @ApiOperation({ summary: 'section মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectionsService.remove(id);
  }
}
