import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { UsersService } from '../users/users.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Student } from './entities/student.entity';
import { StudentsRepository } from './students.repository';

@Injectable()
export class StudentsService {
  constructor(
    private readonly studentsRepository: StudentsRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateStudentDto): Promise<Student> {
    const existing = await this.studentsRepository.findByStudentCode(
      dto.studentCode,
    );
    if (existing) {
      throw new ConflictException('Student code already exists');
    }
    if (dto.userId) {
      await this.usersService.findOne(dto.userId);
    }
    const student = this.studentsRepository.create(dto);
    return this.studentsRepository.save(student);
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.studentsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Student> {
    const student = await this.studentsRepository.findById(id);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async findWithEnrollment(id: string): Promise<Student> {
    const student = await this.studentsRepository.findByIdWithEnrollment(id);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id);
    if (dto.studentCode && dto.studentCode !== student.studentCode) {
      const clash = await this.studentsRepository.findByStudentCode(
        dto.studentCode,
      );
      if (clash) {
        throw new ConflictException('Student code already exists');
      }
    }
    if (dto.userId) {
      await this.usersService.findOne(dto.userId);
    }
    Object.assign(student, dto);
    return this.studentsRepository.save(student);
  }

  async remove(id: string): Promise<{ message: string }> {
    const student = await this.findOne(id);
    await this.studentsRepository.remove(student);
    return { message: 'Student deleted successfully' };
  }
}
