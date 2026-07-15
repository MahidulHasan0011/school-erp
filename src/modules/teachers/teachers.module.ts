import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Teacher } from './entities/teacher.entity';
import { TeachersController } from './teachers.controller';
import { TeachersRepository } from './teachers.repository';
import { TeachersService } from './teachers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Teacher]), UsersModule],
  controllers: [TeachersController],
  providers: [TeachersService, TeachersRepository],
  exports: [TeachersService, TeachersRepository],
})
export class TeachersModule {}
