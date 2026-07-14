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
import { AcademicSessionsService } from './academic-sessions.service';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';

@ApiTags('academic-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('academic-sessions')
export class AcademicSessionsController {
  constructor(private readonly sessionsService: AcademicSessionsService) {}

  // ⚠️ '/active' অবশ্যই '/:id'-এর আগে — নইলে 'active' কে UUID param ধরে ফেলবে
  @Get('active')
  @Permissions('SESSION_READ')
  @ApiOperation({ summary: 'বর্তমান active session' })
  getActive() {
    return this.sessionsService.getActive();
  }

  @Get()
  @Permissions('SESSION_READ')
  @ApiOperation({ summary: 'সব session (paginated)' })
  findAll(@Query() query: PaginationDto) {
    return this.sessionsService.findAll(query);
  }

  @Get(':id')
  @Permissions('SESSION_READ')
  @ApiOperation({ summary: 'একটি session' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOne(id);
  }

  @Post()
  @Permissions('SESSION_CREATE')
  @ApiOperation({ summary: 'নতুন session তৈরি' })
  create(@Body() dto: CreateAcademicSessionDto) {
    return this.sessionsService.create(dto);
  }

  @Patch(':id')
  @Permissions('SESSION_UPDATE')
  @ApiOperation({ summary: 'session আপডেট' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicSessionDto,
  ) {
    return this.sessionsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('SESSION_DELETE')
  @ApiOperation({ summary: 'session মুছে ফেলা' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.remove(id);
  }

  @Patch(':id/activate')
  @Permissions('SESSION_UPDATE')
  @ApiOperation({ summary: 'session active করা (বাকিগুলো inactive হয়)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.activate(id);
  }

  @Patch(':id/deactivate')
  @Permissions('SESSION_UPDATE')
  @ApiOperation({ summary: 'session inactive করা' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.deactivate(id);
  }

  @Patch(':id/admission-test')
  @Permissions('SESSION_UPDATE')
  @ApiOperation({ summary: 'admission test enable/disable toggle' })
  toggleAdmissionTest(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.toggleAdmissionTest(id);
  }
}
