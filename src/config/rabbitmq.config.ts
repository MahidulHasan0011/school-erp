import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  // একসাথে কতগুলো unacked message একটি consumer ধরবে
  prefetch: parseInt(process.env.RABBITMQ_PREFETCH ?? '5', 10),
}));
