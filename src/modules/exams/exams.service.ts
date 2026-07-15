import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { CreateExamDto } from './dto/create-exam.dto';
import { QueryExamsDto } from './dto/query-exams.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { Exam, ExamStatus } from './entities/exam.entity';
import { ExamsRepository } from './exams.repository';

@Injectable()
export class ExamsService {
  constructor(private readonly examsRepository: ExamsRepository) {}

  async create(dto: CreateExamDto): Promise<Exam> {
    await this.validateRefs(dto.classId, dto.academicSessionId);
    const exam = this.examsRepository.create(dto);
    return this.examsRepository.save(exam);
  }

  async findAll(query: QueryExamsDto) {
    const [data, total] = await this.examsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Exam> {
    const exam = await this.examsRepository.findById(id);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  async update(id: string, dto: UpdateExamDto): Promise<Exam> {
    const exam = await this.findOne(id);
    await this.validateRefs(dto.classId, dto.academicSessionId);
    Object.assign(exam, dto);
    return this.examsRepository.save(exam);
  }

  async publish(id: string): Promise<Exam> {
    const exam = await this.findOne(id);
    exam.status = ExamStatus.PUBLISHED;
    return this.examsRepository.save(exam);
  }

  async unpublish(id: string): Promise<Exam> {
    const exam = await this.findOne(id);
    exam.status = ExamStatus.DRAFT;
    return this.examsRepository.save(exam);
  }

  async remove(id: string): Promise<{ message: string }> {
    const exam = await this.findOne(id);
    await this.examsRepository.remove(exam);
    return { message: 'Exam deleted successfully' };
  }

  private async validateRefs(
    classId?: string,
    academicSessionId?: string,
  ): Promise<void> {
    if (classId && !(await this.examsRepository.classExists(classId))) {
      throw new BadRequestException('Unknown class id');
    }
    if (
      academicSessionId &&
      !(await this.examsRepository.sessionExists(academicSessionId))
    ) {
      throw new BadRequestException('Unknown academic session id');
    }
  }
}
