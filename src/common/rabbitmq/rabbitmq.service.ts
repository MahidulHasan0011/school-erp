import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export type JobHandler<T> = (payload: T) => Promise<void>;

export interface ConsumerOptions {
  /** মোট কতবার চেষ্টা হবে (ব্যর্থ হলে retry সহ)। default 3 */
  maxAttempts?: number;
  /** প্রথম retry-এর বেস delay (ms)। exponential: base * 2^(attempt-1)। default 2000 */
  baseDelayMs?: number;
}

const EXCHANGE = 'app.jobs';
const RETRY_BUCKET_MS = 250; // delay queue সংখ্যা bound রাখতে round

/**
 * হালকা RabbitMQ wrapper — job publish ও consume, এবং ব্যর্থ job-এর জন্য
 * exponential-backoff retry (delay queue + DLX দিয়ে, কোনো plugin ছাড়াই)।
 * max attempt শেষ হলে message `<queue>.dlq` (parking lot)-এ যায়।
 */
@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  // (re)connect হলে আবার চালানোর জন্য consumer setup গুলো জমা থাকে
  private readonly registrations: Array<() => Promise<void>> = [];
  private connecting = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // shutdown — উপেক্ষা
    }
  }

  private async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    const url = this.config.get<string>('rabbitmq.url') as string;
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
      await this.channel.prefetch(
        this.config.get<number>('rabbitmq.prefetch') ?? 5,
      );

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — 5s পরে reconnect');
        this.connection = null;
        this.channel = null;
        setTimeout(() => void this.connect(), 5000);
      });
      this.connection.on('error', (e: Error) =>
        this.logger.error(`RabbitMQ error: ${e.message}`),
      );

      // (re)connect-এর পর সব consumer আবার bind করা
      for (const setup of this.registrations) {
        await setup();
      }
      this.logger.log('RabbitMQ connected');
    } catch (err) {
      this.logger.error(
        `RabbitMQ connect ব্যর্থ — 5s পরে retry: ${(err as Error).message}`,
      );
      setTimeout(() => void this.connect(), 5000);
    } finally {
      this.connecting = false;
    }
  }

  /** একটি job queue-তে message পাঠায়। */
  async publish<T>(queue: string, payload: T): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel প্রস্তুত নয়');
    }
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, EXCHANGE, queue);
    this.channel.publish(EXCHANGE, queue, this.encode(payload), {
      persistent: true,
      headers: { 'x-attempts': 0 },
    });
  }

  /** একটি queue-এর consumer register করে (reconnect-এও টিকে থাকে)। */
  async registerConsumer<T>(
    queue: string,
    handler: JobHandler<T>,
    options: ConsumerOptions = {},
  ): Promise<void> {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 2000;

    const setup = async (): Promise<void> => {
      const ch = this.channel;
      if (!ch) return;
      await ch.assertExchange(EXCHANGE, 'direct', { durable: true });
      await ch.assertQueue(queue, { durable: true });
      await ch.bindQueue(queue, EXCHANGE, queue);
      await ch.assertQueue(`${queue}.dlq`, { durable: true });
      await ch.consume(queue, (msg) => {
        if (msg) {
          void this.handleMessage(queue, msg, handler, maxAttempts, baseDelayMs);
        }
      });
      this.logger.log(`Consumer bound: ${queue} (maxAttempts=${maxAttempts})`);
    };

    this.registrations.push(setup);
    if (this.channel) {
      await setup();
    }
  }

  private async handleMessage<T>(
    queue: string,
    msg: amqp.ConsumeMessage,
    handler: JobHandler<T>,
    maxAttempts: number,
    baseDelayMs: number,
  ): Promise<void> {
    const ch = this.channel;
    if (!ch) return;
    const attempts = Number(msg.properties.headers?.['x-attempts'] ?? 0);
    try {
      const payload = JSON.parse(msg.content.toString()) as T;
      await handler(payload);
      ch.ack(msg);
    } catch (err) {
      const nextAttempts = attempts + 1;
      const message = (err as Error).message;
      if (nextAttempts >= maxAttempts) {
        // parking lot — আর retry নয়
        ch.sendToQueue(`${queue}.dlq`, msg.content, {
          persistent: true,
          headers: { 'x-attempts': nextAttempts, 'x-error': message },
        });
        ch.ack(msg);
        this.logger.error(
          `Job ${queue} ${nextAttempts} বার ব্যর্থ → DLQ: ${message}`,
        );
      } else {
        const delay = this.computeBackoff(nextAttempts, baseDelayMs);
        await this.scheduleRetry(queue, msg.content, nextAttempts, delay);
        ch.ack(msg);
        this.logger.warn(
          `Job ${queue} attempt ${nextAttempts} ব্যর্থ — ${delay}ms পরে retry: ${message}`,
        );
      }
    }
  }

  /** delay queue (TTL + DLX) দিয়ে message পরে আবার main queue-তে ফেরত পাঠায়। */
  private async scheduleRetry(
    queue: string,
    content: Buffer,
    attempts: number,
    delayMs: number,
  ): Promise<void> {
    const ch = this.channel;
    if (!ch) return;
    const delayQueue = `${queue}.delay.${delayMs}`;
    await ch.assertQueue(delayQueue, {
      durable: true,
      arguments: {
        'x-message-ttl': delayMs,
        'x-dead-letter-exchange': EXCHANGE,
        'x-dead-letter-routing-key': queue,
      },
    });
    ch.sendToQueue(delayQueue, content, {
      persistent: true,
      headers: { 'x-attempts': attempts },
    });
  }

  /** exponential backoff + jitter (250ms bucket-এ round করে delay queue bound রাখে)। */
  private computeBackoff(attempt: number, baseDelayMs: number): number {
    const exp = baseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * exp * 0.2);
    return Math.max(
      RETRY_BUCKET_MS,
      Math.round((exp + jitter) / RETRY_BUCKET_MS) * RETRY_BUCKET_MS,
    );
  }

  private encode<T>(payload: T): Buffer {
    return Buffer.from(JSON.stringify(payload));
  }
}
