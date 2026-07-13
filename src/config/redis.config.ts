import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  // cloud Redis (Upstash ইত্যাদি) TLS চায় — REDIS_TLS=true দিলে চালু হবে
  tls: process.env.REDIS_TLS === 'true',
}));
