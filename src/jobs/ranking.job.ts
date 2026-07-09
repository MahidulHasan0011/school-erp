import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RANKING_QUEUE } from '../queues/ranking.queue';

@Processor(RANKING_QUEUE)
export class RankingJob extends WorkerHost {
  private readonly logger = new Logger(RankingJob.name);

  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing ranking job ${job.id}: ${JSON.stringify(job.data)}`,
    );
    // TODO: load exam results, call RankingEngine, persist ranks
  }
}
