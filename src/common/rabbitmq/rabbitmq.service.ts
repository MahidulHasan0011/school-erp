import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export type JobHandler<T> = (payload: T) => Promise<void>;

/** DLQ (parking lot)-এ পার্ক হওয়া একটি ব্যর্থ job-এর inspect view। */
export interface DlqMessage {
  /** কতবার চেষ্টার পর DLQ-তে গেছে। */
  attempts: number;
  /** সর্বশেষ ব্যর্থতার error message (থাকলে)। */
  error: string | null;
  /** মূল payload (JSON parse করা; না হলে raw string)। */
  payload: unknown;
}

/** peekDlq-এর ফলাফল — কতটা দেখানো হলো ও DLQ-তে মোট কতটা আছে। */
export interface DlqPage {
  queue: string;
  /** এই কলে ফেরত দেওয়া message (limit পর্যন্ত)। */
  messages: DlqMessage[];
  /** messages.length — limit-এ কাটা পড়েছে কিনা বোঝার সুবিধায়। */
  returned: number;
  /** DLQ-তে মোট কতটা message আছে। */
  total: number;
  /** true হলে total > returned — আরও message বাকি আছে। */
  truncated: boolean;
}

export interface ConsumerOptions {
  /** মোট কতবার চেষ্টা হবে (ব্যর্থ হলে retry সহ)। default 3 */
  maxAttempts?: number;
  /** প্রথম retry-এর বেস delay (ms)। exponential: base * 2^(attempt-1)। default 2000 */
  baseDelayMs?: number;
  /** backoff-এর সর্বোচ্চ delay (ms) cap। default config.maxDelayMs (60000) */
  maxDelayMs?: number;
}

const EXCHANGE = 'app.jobs';
const RETRY_BUCKET_MS = 250; // delay queue সংখ্যা bound রাখতে round
const RECONNECT_DELAY_MS = 5000;
/**
 * delay queue নামের marker। `x-expires` যোগ করার সময় নাম বদলানো হয়েছে —
 * পুরনো `<queue>.delay.<ms>` queue গুলো ভিন্ন argument-এ declare করা ছিল, একই নামে
 * নতুন argument দিয়ে assert করলে RabbitMQ `PRECONDITION_FAILED` দিয়ে channel মেরে দিত।
 * পুরনো `*.delay.*` queue গুলো (খালি) management UI থেকে হাতে মুছে ফেলা যায়।
 */
const DELAY_MARKER = 'delay.v2';

/**
 * হালকা RabbitMQ wrapper — job publish ও consume, এবং ব্যর্থ job-এর জন্য
 * exponential-backoff retry (delay queue + DLX দিয়ে, কোনো plugin ছাড়াই)।
 * max attempt শেষ হলে message `<queue>.dlq` (parking lot)-এ যায়।
 *
 * Channel বিন্যাস — তিন ভাগে আলাদা, কারণ AMQP-তে একটা channel error পুরো channel
 * বন্ধ করে দেয়:
 *   - `pubChannel` (confirm)  → সব publish; broker নিশ্চিত করার পরই resolve হয়
 *   - `subChannel`            → শুধু consume + ack/nack
 *   - temp channel (per call) → DLQ peek/replay; error হলে শুধু ওই কাজটাই ফেলে দেয়
 * একই channel-এ publish ও consume রাখলে publish-এর একটা ভুল সব consumer-কে
 * নীরবে মেরে ফেলত।
 */
@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private pubChannel: amqp.ConfirmChannel | null = null;
  private subChannel: amqp.Channel | null = null;
  // (re)connect হলে আবার চালানোর জন্য consumer setup গুলো জমা থাকে
  private readonly registrations: Array<() => Promise<void>> = [];
  private connecting = false;
  private rebuildingChannels = false;
  private shuttingDown = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true; // reconnect/rebuild আর শুরু হবে না
    try {
      await this.pubChannel?.close();
      await this.subChannel?.close();
      await this.connection?.close();
    } catch {
      // shutdown
    }
  }

  private async connect(): Promise<void> {
    if (this.connecting || this.shuttingDown) return;
    this.connecting = true;
    const url = this.config.get<string>('rabbitmq.url') as string;
    try {
      this.connection = await amqp.connect(url);

      this.connection.on('close', () => {
        if (this.shuttingDown) return;
        this.logger.warn(
          `RabbitMQ connection closed — ${RECONNECT_DELAY_MS}ms পরে reconnect`,
        );
        this.connection = null;
        this.pubChannel = null;
        this.subChannel = null;
        setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
      });
      this.connection.on('error', (e: Error) =>
        this.logger.error(`RabbitMQ connection error: ${e.message}`),
      );

      await this.setupChannels();
      this.logger.log('RabbitMQ connected');
    } catch (err) {
      this.logger.error(
        `RabbitMQ connect ব্যর্থ — ${RECONNECT_DELAY_MS}ms পরে retry: ${(err as Error).message}`,
      );
      setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
    } finally {
      this.connecting = false;
    }
  }

  /**
   * publish ও consume channel তৈরি করে এবং সব consumer আবার bind করে।
   * প্রতিটা channel-এ `error`/`close` listener আছে — channel connection থেকে
   * আলাদাভাবে মরতে পারে (যেমন PRECONDITION_FAILED), তখন connection বেঁচে থাকায়
   * connection-এর `close` কখনো চলে না। listener ছাড়া সব consumer নীরবে মরে যেত।
   */
  private async setupChannels(): Promise<void> {
    const conn = this.connection;
    if (!conn || this.shuttingDown) return;

    this.pubChannel = await conn.createConfirmChannel();
    this.subChannel = await conn.createChannel();

    for (const [name, ch] of [
      ['publish', this.pubChannel],
      ['consume', this.subChannel],
    ] as const) {
      ch.on('error', (e: Error) =>
        this.logger.error(`RabbitMQ ${name} channel error: ${e.message}`),
      );
      ch.on('close', () => {
        if (this.shuttingDown || !this.connection) return;
        this.logger.warn(
          `RabbitMQ ${name} channel closed — channel আবার তৈরি হবে`,
        );
        this.scheduleChannelRebuild();
      });
    }

    await this.pubChannel.assertExchange(EXCHANGE, 'direct', { durable: true });
    await this.subChannel.assertExchange(EXCHANGE, 'direct', { durable: true });
    await this.subChannel.prefetch(
      this.config.get<number>('rabbitmq.prefetch') ?? 5,
    );

    // (re)connect বা channel rebuild-এর পর সব consumer আবার bind করা
    for (const setup of this.registrations) {
      await setup();
    }
  }

  /** channel মরলে একবারই rebuild চালায় (দুই channel একসাথে মরলেও একবার)। */
  private scheduleChannelRebuild(): void {
    if (this.rebuildingChannels || this.shuttingDown) return;
    this.rebuildingChannels = true;
    setTimeout(() => {
      void (async () => {
        try {
          await this.setupChannels();
          this.logger.log('RabbitMQ channel আবার তৈরি হয়েছে');
        } catch (err) {
          this.logger.error(
            `channel rebuild ব্যর্থ: ${(err as Error).message}`,
          );
        } finally {
          this.rebuildingChannels = false;
        }
      })();
    }, RECONNECT_DELAY_MS);
  }

  /**
   * একটি job queue-তে message পাঠায় — confirm channel দিয়ে, তাই broker
   * message গ্রহণ করার পরই resolve হয়। এতে "202 queued বললাম কিন্তু message
   * হারিয়ে গেল" পরিস্থিতি হয় না।
   */
  async publish<T>(queue: string, payload: T): Promise<void> {
    const ch = this.pubChannel;
    if (!ch) {
      throw new Error('RabbitMQ channel is not ready');
    }
    await ch.assertQueue(queue, { durable: true });
    await ch.bindQueue(queue, EXCHANGE, queue);
    await this.confirmPublish(ch, EXCHANGE, queue, this.encode(payload), {
      persistent: true,
      headers: { 'x-attempts': 0 },
    });
  }

  /**
   * DLQ (`<queue>.dlq`)-এ পার্ক হওয়া job-গুলো non-destructive ভাবে পড়ে।
   * প্রতিটি message get করে দেখা হয়, তারপর requeue (nack) করে ফেরত দেওয়া হয় —
   * তাই peek করলে DLQ থেকে কিছুই মুছে যায় না। মোট সংখ্যা (`total`)-ও ফেরত দেয়,
   * তাই limit-এ কাটা পড়লে অ্যাডমিন বুঝতে পারে আরও বাকি আছে।
   */
  peekDlq(queue: string, limit = 50): Promise<DlqPage> {
    return this.withTempChannel(async (ch) => {
      const dlq = `${queue}.dlq`;
      const info = await ch.assertQueue(dlq, { durable: true });

      const messages: DlqMessage[] = [];
      const held: amqp.GetMessage[] = [];
      for (let i = 0; i < limit; i++) {
        const msg = await ch.get(dlq, { noAck: false });
        if (!msg) break; // queue empty
        messages.push({
          attempts: Number(msg.properties.headers?.['x-attempts'] ?? 0),
          error: (msg.properties.headers?.['x-error'] as string) ?? null,
          payload: this.tryDecode(msg.content),
        });
        held.push(msg);
      }
      // non-destructive — সব message requeue করে DLQ-তে ফেরত পাঠাই
      for (const msg of held) {
        ch.nack(msg, false, true);
      }
      return {
        queue: dlq,
        messages,
        returned: messages.length,
        total: info.messageCount,
        truncated: info.messageCount > messages.length,
      };
    });
  }

  /**
   * DLQ থেকে message গুলো main queue-তে ফেরত পাঠায় (`x-attempts` reset করে),
   * যাতে retry chain আবার শূন্য থেকে শুরু হয়। ফেরত পাঠানো message DLQ থেকে
   * সরে যায় (destructive)। কতগুলো move হলো তা ফেরত দেয়।
   */
  replayDlq(queue: string, limit = 100): Promise<number> {
    return this.withTempChannel(async (ch) => {
      const dlq = `${queue}.dlq`;
      await ch.assertExchange(EXCHANGE, 'direct', { durable: true });
      await ch.assertQueue(queue, { durable: true });
      await ch.bindQueue(queue, EXCHANGE, queue);
      await ch.assertQueue(dlq, { durable: true });

      let moved = 0;
      for (let i = 0; i < limit; i++) {
        const msg = await ch.get(dlq, { noAck: false });
        if (!msg) break; // DLQ empty
        // main queue-তে ফেরত — attempts শূন্য থেকে শুরু।
        // confirm channel, তাই broker নিশ্চিত করার *পরে* DLQ থেকে সরাই।
        await this.confirmPublish(ch, EXCHANGE, queue, msg.content, {
          persistent: true,
          headers: { 'x-attempts': 0 },
        });
        ch.ack(msg);
        moved++;
      }
      if (moved > 0) {
        this.logger.log(`DLQ replay: ${queue} → ${moved}টি job আবার queue-তে`);
      }
      return moved;
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
    const maxDelayMs =
      options.maxDelayMs ??
      this.config.get<number>('rabbitmq.maxDelayMs') ??
      60000;

    const setup = async (): Promise<void> => {
      const ch = this.subChannel;
      if (!ch) return;
      await ch.assertQueue(queue, { durable: true });
      await ch.bindQueue(queue, EXCHANGE, queue);
      await ch.assertQueue(`${queue}.dlq`, { durable: true });
      await ch.consume(queue, (msg) => {
        if (msg) {
          void this.handleMessage(
            queue,
            msg,
            handler,
            maxAttempts,
            baseDelayMs,
            maxDelayMs,
          );
        }
      });
      this.logger.log(`Consumer bound: ${queue} (maxAttempts=${maxAttempts})`);
    };

    this.registrations.push(setup);
    if (this.subChannel) {
      await setup();
    }
  }

  private async handleMessage<T>(
    queue: string,
    msg: amqp.ConsumeMessage,
    handler: JobHandler<T>,
    maxAttempts: number,
    baseDelayMs: number,
    maxDelayMs: number,
  ): Promise<void> {
    const ch = this.subChannel;
    if (!ch) return;
    const attempts = Number(msg.properties.headers?.['x-attempts'] ?? 0);

    // poison message — malformed JSON কখনোই retry-তে সফল হবে না, তাই
    // সরাসরি DLQ-তে; ৩ বার অপেক্ষা করে সময় নষ্ট করার মানে নেই।
    let payload: T;
    try {
      payload = JSON.parse(msg.content.toString()) as T;
    } catch (err) {
      await this.parkInDlq(
        queue,
        msg,
        ch,
        attempts,
        `malformed JSON: ${(err as Error).message}`,
      );
      return;
    }

    try {
      await handler(payload);
      this.safeAck(ch, msg);
    } catch (err) {
      const nextAttempts = attempts + 1;
      const message = (err as Error).message;
      try {
        if (nextAttempts >= maxAttempts) {
          await this.parkInDlq(queue, msg, ch, nextAttempts, message);
          this.logger.error(
            `Job ${queue} ${nextAttempts} বার ব্যর্থ → DLQ: ${message}`,
          );
        } else {
          const delay = this.computeBackoff(
            nextAttempts,
            baseDelayMs,
            maxDelayMs,
          );
          // confirm-এর পরেই ack — retry কপি broker-এ পৌঁছানোর নিশ্চয়তা ছাড়া
          // মূল message ছাড়লে job একেবারে হারিয়ে যেত।
          await this.scheduleRetry(queue, msg.content, nextAttempts, delay);
          this.safeAck(ch, msg);
          this.logger.warn(
            `Job ${queue} attempt ${nextAttempts} ব্যর্থ — ${delay}ms পরে retry: ${message}`,
          );
        }
      } catch (publishErr) {
        // retry/DLQ কপি পাঠানো যায়নি → ack করব না, message queue-তে ফিরে যাবে
        this.logger.error(
          `Job ${queue} retry/DLQ publish ব্যর্থ (${(publishErr as Error).message}) — message requeue হবে`,
        );
        this.safeNack(ch, msg);
      }
    }
  }

  /** message-কে `<queue>.dlq`-এ পার্ক করে (confirm-এর পরে ack)। */
  private async parkInDlq(
    queue: string,
    msg: amqp.ConsumeMessage,
    ch: amqp.Channel,
    attempts: number,
    error: string,
  ): Promise<void> {
    const pub = this.pubChannel;
    if (!pub) throw new Error('RabbitMQ publish channel is not ready');
    const dlq = `${queue}.dlq`;
    await pub.assertQueue(dlq, { durable: true });
    await this.confirmSendToQueue(pub, dlq, msg.content, {
      persistent: true,
      headers: { 'x-attempts': attempts, 'x-error': error },
    });
    this.safeAck(ch, msg);
  }

  /** delay queue (TTL + DLX) দিয়ে message পরে আবার main queue-তে ফেরত পাঠায়। */
  private async scheduleRetry(
    queue: string,
    content: Buffer,
    attempts: number,
    delayMs: number,
  ): Promise<void> {
    const ch = this.pubChannel;
    if (!ch) throw new Error('RabbitMQ publish channel is not ready');
    const delayQueue = `${queue}.${DELAY_MARKER}.${delayMs}`;
    await ch.assertQueue(delayQueue, {
      durable: true,
      arguments: {
        'x-message-ttl': delayMs,
        'x-dead-letter-exchange': EXCHANGE,
        'x-dead-letter-routing-key': queue,
        // অব্যবহৃত থাকলে queue নিজেই মুছে যাবে — TTL-এর চেয়ে অনেক বেশি সময়
        // দেওয়া হয়েছে, তাই ভেতরের message কখনো TTL-এর আগে হারাবে না
        'x-expires': delayMs + 600_000,
      },
    });
    await this.confirmSendToQueue(ch, delayQueue, content, {
      persistent: true,
      headers: { 'x-attempts': attempts },
    });
  }

  /**
   * Exponential backoff + "Equal Jitter" (AWS-সুপারিশকৃত কৌশল)।
   *
   *   capped = min(maxDelayMs, base * 2^(attempt-1))   ← cap দিয়ে বাঁধা
   *   delay  = capped/2 + random(0, capped/2)          ← অর্ধেক নিশ্চিত + অর্ধেক random
   *
   * অর্ধেকটা fixed রাখায় delay খুব ছোট হয় না, আর random অর্ধেকটা retry-গুলোকে
   * ছড়িয়ে দেয় — একাধিক worker একই সময়ে fail করলেও সবাই একসাথে retry করে না
   * (thundering herd এড়ায়)। শেষে 250ms bucket-এ round করে delay queue সংখ্যা bound রাখি।
   */
  private computeBackoff(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
  ): number {
    const capped = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
    const half = capped / 2;
    const delay = half + Math.random() * half;
    return Math.max(
      RETRY_BUCKET_MS,
      Math.round(delay / RETRY_BUCKET_MS) * RETRY_BUCKET_MS,
    );
  }

  // ═══════════════════ low-level helpers ═══════════════════

  /** confirm channel-এ publish — broker ack করলে resolve, nack করলে reject। */
  private confirmPublish(
    ch: amqp.ConfirmChannel,
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: amqp.Options.Publish,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ch.publish(exchange, routingKey, content, options, (err) =>
        err ? reject(this.toError(err)) : resolve(),
      );
    });
  }

  /** confirm channel-এ default exchange দিয়ে সরাসরি queue-তে পাঠানো। */
  private confirmSendToQueue(
    ch: amqp.ConfirmChannel,
    queue: string,
    content: Buffer,
    options: amqp.Options.Publish,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ch.sendToQueue(queue, content, options, (err) =>
        err ? reject(this.toError(err)) : resolve(),
      );
    });
  }

  /** amqplib callback-এর error যেকোনো আকারে আসতে পারে — Error-এ পরিণত করি। */
  private toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
  }

  /**
   * DLQ peek/replay-এর জন্য আলাদা, ক্ষণস্থায়ী channel — কাজ শেষে বন্ধ।
   * এতে admin tooling-এর কোনো error (যেমন queue নেই) consumer-দের channel
   * স্পর্শ করে না।
   */
  private async withTempChannel<R>(
    fn: (ch: amqp.ConfirmChannel) => Promise<R>,
  ): Promise<R> {
    const conn = this.connection;
    if (!conn) {
      throw new Error('RabbitMQ connection is not ready');
    }
    const ch = await conn.createConfirmChannel();
    // temp channel-এর error শুধু এই কলটাই ব্যর্থ করবে — unhandled হয়ে app ফেলবে না
    ch.on('error', (e: Error) =>
      this.logger.warn(`DLQ temp channel error: ${e.message}`),
    );
    try {
      return await fn(ch);
    } finally {
      try {
        await ch.close();
      } catch {
        // ইতিমধ্যে বন্ধ
      }
    }
  }

  /**
   * ack করার আগে দেখে নেয় channel এখনো সেই একই channel কিনা — দীর্ঘ handler
   * চলার মাঝে reconnect/rebuild হলে পুরনো channel-এ ack করা throw করত
   * (unhandled rejection)। channel বদলে গেলে ack বাদ দিই; broker message
   * আবার deliver করবে, তাই কাজ হারায় না।
   */
  private safeAck(ch: amqp.Channel, msg: amqp.ConsumeMessage): void {
    if (this.subChannel !== ch) {
      this.logger.warn('channel বদলে গেছে — ack বাদ, message আবার আসবে');
      return;
    }
    try {
      ch.ack(msg);
    } catch (err) {
      this.logger.warn(`ack ব্যর্থ: ${(err as Error).message}`);
    }
  }

  private safeNack(ch: amqp.Channel, msg: amqp.ConsumeMessage): void {
    if (this.subChannel !== ch) return;
    try {
      ch.nack(msg, false, true);
    } catch (err) {
      this.logger.warn(`nack ব্যর্থ: ${(err as Error).message}`);
    }
  }

  private tryDecode(content: Buffer): unknown {
    try {
      return JSON.parse(content.toString());
    } catch {
      return content.toString();
    }
  }

  private encode<T>(payload: T): Buffer {
    return Buffer.from(JSON.stringify(payload));
  }
}
