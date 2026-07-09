import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const ROLL_QUEUE = 'roll';

/**
 * Producer for roll-number recomputation jobs.
 * Register with `BullModule.registerQueue({ name: ROLL_QUEUE })` in a module.
 */
@Injectable()
export class RollQueue {
  constructor(@InjectQueue(ROLL_QUEUE) private readonly queue: Queue) {}

  enqueueRecompute(sectionId: string) {
    return this.queue.add('recompute', { sectionId });
  }
}
