import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
} from '../../common/utils/query-builder.util';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { Notification } from './entities/notification.entity';

const SORTABLE_COLUMNS = ['createdAt', 'isRead', 'type'];

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  createMany(rows: Partial<Notification>[]): Promise<Notification[]> {
    return this.repo.save(this.repo.create(rows));
  }

  save(notification: Notification): Promise<Notification> {
    return this.repo.save(notification);
  }

  /** নির্দিষ্ট user-এর একটি notification (নিজের বলেই ফিরবে)। */
  findOneForUser(id: string, recipientId: string): Promise<Notification | null> {
    return this.repo.findOne({ where: { id, recipientId } });
  }

  findMine(
    recipientId: string,
    query: QueryNotificationsDto,
  ): Promise<[Notification[], number]> {
    const qb = this.repo
      .createQueryBuilder('notification')
      .where('notification.recipientId = :recipientId', { recipientId });

    applyFilters(qb, 'notification', {
      isRead: query.isRead,
      type: query.type,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'notification', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  unreadCount(recipientId: string): Promise<number> {
    return this.repo.count({ where: { recipientId, isRead: false } });
  }

  /** user-এর সব unread → read; কতগুলো বদলালো ফেরত দেয়। */
  async markAllRead(recipientId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'NOW()', updatedAt: () => 'NOW()' })
      .where('recipient_id = :recipientId', { recipientId })
      .andWhere('is_read = false')
      .andWhere('deleted_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  async remove(notification: Notification): Promise<void> {
    await this.repo.softRemove(notification);
  }
}
