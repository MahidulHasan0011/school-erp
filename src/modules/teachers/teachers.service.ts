import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { UsersService } from '../users/users.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { Teacher } from './entities/teacher.entity';
import { TeachersRepository } from './teachers.repository';

@Injectable()
export class TeachersService {
  constructor(
    private readonly teachersRepository: TeachersRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateTeacherDto): Promise<Teacher> {
    // linked user আছে কিনা যাচাই (না থাকলে NotFound throw করে)
    await this.usersService.findOne(dto.userId);

    // এক user-এর একটাই teacher profile (DB unique constraint-ও আছে)
    const existing = await this.teachersRepository.findByUserId(dto.userId);
    if (existing) {
      throw new ConflictException(
        'This user is already linked to a teacher profile',
      );
    }

    const teacher = this.teachersRepository.create(dto);
    return this.teachersRepository.save(teacher);
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.teachersRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Teacher> {
    const teacher = await this.teachersRepository.findById(id);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    return teacher;
  }

  async findWithAssignments(id: string): Promise<Teacher> {
    const teacher = await this.teachersRepository.findByIdWithAssignments(id);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
    const teacher = await this.findOne(id);
    Object.assign(teacher, dto);
    return this.teachersRepository.save(teacher);
  }

  async remove(id: string): Promise<{ message: string }> {
    const teacher = await this.findOne(id);
    await this.teachersRepository.remove(teacher);
    return { message: 'Teacher deleted successfully' };
  }
}
