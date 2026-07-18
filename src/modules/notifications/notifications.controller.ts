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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Permissions('NOTIFICATION_CREATE')
  @ApiOperation({ summary: 'এক/একাধিক user-কে notification পাঠানো' })
  create(
    @Body() dto: CreateNotificationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.create(dto, userId);
  }

  @Get('me')
  @Permissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'আমার notification (paginated + isRead/type filter)' })
  findMine(
    @CurrentUser('id') userId: string,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findMine(userId, query);
  }

  @Get('me/unread-count')
  @Permissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'আমার unread notification সংখ্যা' })
  async unreadCount(@CurrentUser('id') userId: string) {
    return { unread: await this.notificationsService.unreadCount(userId) };
  }

  @Patch('read-all')
  @Permissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'আমার সব notification read হিসেবে চিহ্নিত' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  @Permissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'একটি notification read হিসেবে চিহ্নিত' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markRead(id, userId);
  }

  @Delete(':id')
  @Permissions('NOTIFICATION_DELETE')
  @ApiOperation({ summary: 'নিজের notification মুছে ফেলা' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.remove(id, userId);
  }
}
