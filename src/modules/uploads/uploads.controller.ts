import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { GenerateUrlDto } from './dto/generate-url.dto';
import { QueryUploadsDto } from './dto/query-uploads.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('generate-url')
  @Permissions('UPLOAD_CREATE')
  @ApiOperation({ summary: 'presigned PUT URL + PENDING record তৈরি (STEP 1)' })
  generateUrl(
    @Body() dto: GenerateUrlDto,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.uploadsService.generateUrl(dto, { actorId: userId, ip, userAgent });
  }

  @Post('confirm')
  @Permissions('UPLOAD_CREATE')
  @ApiOperation({ summary: 'upload শেষে record READY করা (STEP 2)' })
  confirm(
    @Body() dto: ConfirmUploadDto,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.uploadsService.confirm(dto, { actorId: userId, ip, userAgent });
  }

  @Post('bulk-delete')
  @Permissions('UPLOAD_DELETE')
  @ApiOperation({ summary: 'একাধিক upload একসাথে soft-delete' })
  bulkDelete(
    @Body() dto: BulkDeleteDto,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.uploadsService.bulkDelete(dto, {
      actorId: userId,
      ip,
      userAgent,
    });
  }

  @Get()
  @Permissions('UPLOAD_READ')
  @ApiOperation({ summary: 'সব upload (paginated + filter/search)' })
  findAll(@Query() query: QueryUploadsDto) {
    return this.uploadsService.findAll(query);
  }

  @Get(':id')
  @Permissions('UPLOAD_READ')
  @ApiOperation({ summary: 'একটি upload-এর তথ্য' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.uploadsService.findOne(id);
  }

  @Get(':id/download')
  @Permissions('UPLOAD_READ')
  @ApiOperation({ summary: 'presigned download URL' })
  download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.uploadsService.download(id, { actorId: userId, ip, userAgent });
  }

  @Delete(':id')
  @Permissions('UPLOAD_DELETE')
  @ApiOperation({ summary: 'upload soft-delete' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.uploadsService.remove(id, { actorId: userId, ip, userAgent });
  }

  @Patch(':id/restore')
  @Permissions('UPLOAD_RESTORE')
  @ApiOperation({ summary: 'soft-deleted upload পুনরুদ্ধার' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.uploadsService.restore(id, { actorId: userId, ip, userAgent });
  }
}
