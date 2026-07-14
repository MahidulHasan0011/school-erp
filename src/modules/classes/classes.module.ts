import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesController } from './classes.controller';
import { ClassesRepository } from './classes.repository';
import { ClassesService } from './classes.service';
import { ClassEntity } from './entities/class.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClassEntity])],
  controllers: [ClassesController],
  providers: [ClassesService, ClassesRepository],
  exports: [ClassesService, ClassesRepository],
})
export class ClassesModule {}
