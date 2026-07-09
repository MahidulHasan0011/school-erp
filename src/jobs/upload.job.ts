import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UPLOAD_QUEUE } from '../queues/upload.queue';

@Processor(UPLOAD_QUEUE)
export class UploadJob extends WorkerHost {
  private readonly logger = new Logger(UploadJob.name);

  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing upload job ${job.id}: ${JSON.stringify(job.data)}`,
    );
    // TODO: post-process uploaded file (thumbnail, virus scan, move to bucket)
  }
}
