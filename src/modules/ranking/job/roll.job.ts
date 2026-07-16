import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../../common/rabbitmq/rabbitmq.service';
import { ROLL_QUEUE, RollJobPayload } from '../ranking.constants';
import { RankingService } from '../ranking.service';

/**
 * STEP 2 worker — roll queue থেকে rankedList নিয়ে roll assign + history + lock
 * + audit করে (RankingService.processRollJob → RollEngine, এক transaction)।
 * ব্যর্থ হলে RabbitMQ exponential-backoff retry (৩ বার), তারপর DLQ।
 * (পুরনো `jobs/roll.job.js`-এর সমতুল্য।)
 */
@Injectable()
export class RollJob implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly rankingService: RankingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.registerConsumer<RollJobPayload>(
      ROLL_QUEUE,
      (payload) => this.rankingService.processRollJob(payload),
      { maxAttempts: 3, baseDelayMs: 2000 },
    );
  }
}
