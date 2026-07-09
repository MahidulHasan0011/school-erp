import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE } from '../queues/notification.queue';

@Processor(NOTIFICATION_QUEUE)
export class NotificationJob extends WorkerHost {
  private readonly logger = new Logger(NotificationJob.name);

  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing notification job ${job.id}: ${JSON.stringify(job.data)}`,
    );
    // TODO: dispatch email/SMS/push via provider
  }
}
