import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../../../common/rabbitmq/rabbitmq.service';
import { RANKING_QUEUE, RankingJobPayload } from '../ranking.constants';

/**
 * Producer — ranking job RabbitMQ queue-তে পাঠায়।
 * (পুরনো Node.js প্রজেক্টের `queues/ranking.queue.js`-এর সমতুল্য।)
 */
@Injectable()
export class RankingQueue {
  constructor(private readonly rabbitmq: RabbitMQService) {}

  publish(payload: RankingJobPayload): Promise<void> {
    return this.rabbitmq.publish(RANKING_QUEUE, payload);
  }
}
