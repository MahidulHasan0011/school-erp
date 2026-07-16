import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';

/**
 * Global RabbitMQ module — একটাই connection/channel পুরো অ্যাপে share হয়।
 * যেকোনো module RabbitMQService inject করে job publish/consume করতে পারবে।
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
