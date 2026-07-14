import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesModule } from '../classes/classes.module';
import { Section } from './entities/section.entity';
import { SectionsController } from './sections.controller';
import { SectionsRepository } from './sections.repository';
import { SectionsService } from './sections.service';

@Module({
  imports: [TypeOrmModule.forFeature([Section]), ClassesModule],
  controllers: [SectionsController],
  providers: [SectionsService, SectionsRepository],
  exports: [SectionsService, SectionsRepository],
})
export class SectionsModule {}
