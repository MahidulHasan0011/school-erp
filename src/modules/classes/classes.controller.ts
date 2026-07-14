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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @Permissions('CLASS_READ')
  @ApiOperation({ summary: 'সব class (paginated)' })
  findAll(@Query() query: PaginationDto) {
    return this.classesService.findAll(query);
  }

  @Get(':id')
  @Permissions('CLASS_READ')
  @ApiOperation({ summary: 'একটি class' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.findOne(id);
  }

  @Get(':id/sections')
  @Permissions('CLASS_READ')
  @ApiOperation({ summary: 'class + তার section গুলো' })
  findWithSections(@Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.findWithSections(id);
  }

  @Post()
  @Permissions('CLASS_CREATE')
  @ApiOperation({ summary: 'নতুন class তৈরি' })
  create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  @Patch(':id')
  @Permissions('CLASS_UPDATE')
  @ApiOperation({ summary: 'class আপডেট' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClassDto) {
    return this.classesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('CLASS_DELETE')
  @ApiOperation({ summary: 'class মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.remove(id);
  }
}
