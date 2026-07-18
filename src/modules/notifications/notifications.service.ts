import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity';
import { NotificationsRepository } from './notifications.repository';

/** অন্য module থেকে notification বানানোর জন্য input (programmatic)। */
export interface NotifyInput {
  recipientId: string;
  title: string;
  message: string;
  type?: NotificationType;
  relatedType?: string;
  relatedId?: string;
  createdBy?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  /** admin — এক বা একাধিক recipient-কে notification পাঠায় (per-recipient row)। */
  async create(
    dto: CreateNotificationDto,
    createdBy: string,
  ): Promise<{ message: string; count: number }> {
    const rows: Partial<Notification>[] = dto.recipientIds.map(
      (recipientId) => ({
        recipientId,
        type: dto.type ?? NotificationType.GENERAL,
        title: dto.title,
        message: dto.message,
        relatedType: dto.relatedType ?? null,
        relatedId: dto.relatedId ?? null,
        createdBy,
      }),
    );
    const saved = await this.notificationsRepository.createMany(rows);
    return { message: 'Notifications sent', count: saved.length };
  }

  /**
   * অন্য module (যেমন leave) থেকে একজনকে notification পাঠানোর helper।
   * ব্যর্থ হলেও মূল flow যেন না ভাঙে — caller চাইলে catch করবে।
   */
  notify(input: NotifyInput): Promise<Notification[]> {
    return this.notificationsRepository.createMany([
      {
        recipientId: input.recipientId,
        type: input.type ?? NotificationType.GENERAL,
        title: input.title,
        message: input.message,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        createdBy: input.createdBy ?? null,
      },
    ]);
  }

  async findMine(userId: string, query: QueryNotificationsDto) {
    const [data, total] = await this.notificationsRepository.findMine(
      userId,
      query,
    );
    return paginate(data, total, query.page, query.limit);
  }

  unreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.unreadCount(userId);
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOneForUser(
      id,
      userId,
    );
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return this.notificationsRepository.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ message: string; updated: number }> {
    const updated = await this.notificationsRepository.markAllRead(userId);
    return { message: 'All notifications marked read', updated };
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    const notification = await this.notificationsRepository.findOneForUser(
      id,
      userId,
    );
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    await this.notificationsRepository.remove(notification);
    return { message: 'Notification deleted' };
  }
}
