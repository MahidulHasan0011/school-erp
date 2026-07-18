import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  // একসাথে কতগুলো unacked message একটি consumer ধরবে
  prefetch: parseInt(process.env.RABBITMQ_PREFETCH ?? '5', 10),
  // backoff-এর সর্বোচ্চ delay (ms) — exponential যত বড়ই হোক এর বেশি নয়
  maxDelayMs: parseInt(process.env.RABBITMQ_MAX_DELAY_MS ?? '60000', 10),
}));
