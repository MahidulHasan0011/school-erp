import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ROLL_QUEUE } from '../queues/roll.queue';

@Processor(ROLL_QUEUE)
export class RollJob extends WorkerHost {
  private readonly logger = new Logger(RollJob.name);

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing roll job ${job.id}: ${JSON.stringify(job.data)}`);
    // TODO: load section students, call RollEngine, persist rolls
  }
}
