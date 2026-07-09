import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const RANKING_QUEUE = 'ranking';

@Injectable()
export class RankingQueue {
  constructor(@InjectQueue(RANKING_QUEUE) private readonly queue: Queue) {}

  enqueueRecompute(examId: string) {
    return this.queue.add('recompute', { examId });
  }
}
