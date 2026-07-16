import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../../../common/rabbitmq/rabbitmq.service';
import { ROLL_QUEUE, RollJobPayload } from '../ranking.constants';

/**
 * Producer — roll job RabbitMQ queue-তে পাঠায় (ranking job থেকে rankedList সহ)।
 * (পুরনো `queues/roll.queue.js`-এর সমতুল্য।)
 */
@Injectable()
export class RollQueue {
  constructor(private readonly rabbitmq: RabbitMQService) {}

  publish(payload: RollJobPayload): Promise<void> {
    return this.rabbitmq.publish(ROLL_QUEUE, payload);
  }
}
