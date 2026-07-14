import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { StudentsService } from '../students/students.service';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { UpdateStudentEnrollmentDto } from './dto/update-student-enrollment.dto';
import { StudentEnrollment } from './entities/student-enrollment.entity';
import { StudentEnrollmentsRepository } from './student-enrollments.repository';

@Injectable()
export class StudentEnrollmentsService {
  constructor(
    private readonly enrollmentsRepository: StudentEnrollmentsRepository,
    private readonly studentsService: StudentsService,
  ) {}

  async create(dto: CreateStudentEnrollmentDto): Promise<StudentEnrollment> {
    // student আছে কিনা (না থাকলে NotFound)
    await this.studentsService.findOne(dto.studentId);
    await this.validateRefs(dto.classId, dto.academicSessionId, dto.sectionId);

    // একই student একই session-এ দুবার ভর্তি হতে পারবে না
    const duplicate = await this.enrollmentsRepository.findByStudentAndSession(
      dto.studentId,
      dto.academicSessionId,
    );
    if (duplicate) {
      throw new ConflictException(
        'This student is already enrolled in the given academic session',
      );
    }

    const enrollment = this.enrollmentsRepository.create(dto);
    return this.enrollmentsRepository.save(enrollment);
  }

  async findAll(query: QueryEnrollmentsDto) {
    const [data, total] =
      await this.enrollmentsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<StudentEnrollment> {
    const enrollment = await this.enrollmentsRepository.findById(id);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    return enrollment;
  }

  async update(
    id: string,
    dto: UpdateStudentEnrollmentDto,
  ): Promise<StudentEnrollment> {
    const enrollment = await this.findOne(id);
    await this.validateRefs(dto.classId, dto.academicSessionId, dto.sectionId);
    Object.assign(enrollment, dto);
    return this.enrollmentsRepository.save(enrollment);
  }

  async remove(id: string): Promise<{ message: string }> {
    const enrollment = await this.findOne(id);
    await this.enrollmentsRepository.remove(enrollment);
    return { message: 'Enrollment deleted successfully' };
  }

  /** class/session/section আসলেই আছে কিনা যাচাই (দেওয়া থাকলে)। */
  private async validateRefs(
    classId?: string,
    academicSessionId?: string,
    sectionId?: string,
  ): Promise<void> {
    if (classId && !(await this.enrollmentsRepository.classExists(classId))) {
      throw new BadRequestException('Unknown class id');
    }
    if (
      academicSessionId &&
      !(await this.enrollmentsRepository.sessionExists(academicSessionId))
    ) {
      throw new BadRequestException('Unknown academic session id');
    }
    if (
      sectionId &&
      !(await this.enrollmentsRepository.sectionExists(sectionId))
    ) {
      throw new BadRequestException('Unknown section id');
    }
  }
}
