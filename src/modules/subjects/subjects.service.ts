import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Subject } from './entities/subject.entity';
import { SubjectsRepository } from './subjects.repository';

@Injectable()
export class SubjectsService {
  constructor(private readonly subjectsRepository: SubjectsRepository) {}

  async create(dto: CreateSubjectDto): Promise<Subject> {
    if (dto.code) {
      const existing = await this.subjectsRepository.findByCode(dto.code);
      if (existing) {
        throw new ConflictException('Subject code already exists');
      }
    }
    const subject = this.subjectsRepository.create(dto);
    return this.subjectsRepository.save(subject);
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.subjectsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Subject> {
    const subject = await this.subjectsRepository.findById(id);
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.findOne(id);
    if (dto.code && dto.code !== subject.code) {
      const clash = await this.subjectsRepository.findByCode(dto.code);
      if (clash) {
        throw new ConflictException('Subject code already exists');
      }
    }
    Object.assign(subject, dto);
    return this.subjectsRepository.save(subject);
  }

  async remove(id: string): Promise<{ message: string }> {
    const subject = await this.findOne(id);
    await this.subjectsRepository.remove(subject);
    return { message: 'Subject deleted successfully' };
  }
}
