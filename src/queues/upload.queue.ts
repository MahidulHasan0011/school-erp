import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const UPLOAD_QUEUE = 'upload';

@Injectable()
export class UploadQueue {
  constructor(@InjectQueue(UPLOAD_QUEUE) private readonly queue: Queue) {}

  enqueueProcess(fileKey: string) {
    return this.queue.add('process', { fileKey });
  }
}
