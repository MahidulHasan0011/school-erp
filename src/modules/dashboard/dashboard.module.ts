import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * শুধু aggregation — নিজের কোনো table/entity নেই। DataSource দিয়ে অন্য
 * module-এর entity গুলো count/query করে (autoLoadEntities-এ সব entity লোড থাকে)।
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
