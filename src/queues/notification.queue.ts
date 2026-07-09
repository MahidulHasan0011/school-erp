import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const NOTIFICATION_QUEUE = 'notification';

@Injectable()
export class NotificationQueue {
  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  enqueueSend(payload: { to: string; template: string; data?: unknown }) {
    return this.queue.add('send', payload);
  }
}
