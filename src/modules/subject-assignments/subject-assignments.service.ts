import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { CreateSubjectAssignmentDto } from './dto/create-subject-assignment.dto';
import { QuerySubjectAssignmentsDto } from './dto/query-subject-assignments.dto';
import { UpdateSubjectAssignmentDto } from './dto/update-subject-assignment.dto';
import { SubjectAssignment } from './entities/subject-assignment.entity';
import { SubjectAssignmentsRepository } from './subject-assignments.repository';

@Injectable()
export class SubjectAssignmentsService {
  constructor(
    private readonly assignmentsRepository: SubjectAssignmentsRepository,
  ) {}

  async create(
    dto: CreateSubjectAssignmentDto,
    assignedBy: string,
  ): Promise<SubjectAssignment> {
    await this.validateRefs(dto);

    const duplicate = await this.assignmentsRepository.findDuplicate(dto);
    if (duplicate) {
      throw new ConflictException(
        'This exact teacher-class-section-subject-session assignment already exists',
      );
    }

    // assigned_by client পাঠায় না — যে user assignment করছে তার id (JWT থেকে)
    const assignment = this.assignmentsRepository.create({
      ...dto,
      assignedBy,
    });
    return this.assignmentsRepository.save(assignment);
  }

  async findAll(query: QuerySubjectAssignmentsDto) {
    const [data, total] = await this.assignmentsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<SubjectAssignment> {
    const assignment = await this.assignmentsRepository.findById(id);
    if (!assignment) {
      throw new NotFoundException('Subject assignment not found');
    }
    return assignment;
  }

  findByTeacher(teacherId: string): Promise<SubjectAssignment[]> {
    return this.assignmentsRepository.findByTeacher(teacherId);
  }

  async update(
    id: string,
    dto: UpdateSubjectAssignmentDto,
  ): Promise<SubjectAssignment> {
    const assignment = await this.findOne(id);
    await this.validateRefs(dto);
    Object.assign(assignment, dto);
    return this.assignmentsRepository.save(assignment);
  }

  async remove(id: string): Promise<{ message: string }> {
    const assignment = await this.findOne(id);
    await this.assignmentsRepository.remove(assignment);
    return { message: 'Subject assignment deleted successfully' };
  }

  /** দেওয়া FK গুলো আসলেই আছে কিনা যাচাই। */
  private async validateRefs(
    dto: Partial<CreateSubjectAssignmentDto>,
  ): Promise<void> {
    if (
      dto.teacherId &&
      !(await this.assignmentsRepository.teacherExists(dto.teacherId))
    ) {
      throw new BadRequestException('Unknown teacher id');
    }
    if (
      dto.classId &&
      !(await this.assignmentsRepository.classExists(dto.classId))
    ) {
      throw new BadRequestException('Unknown class id');
    }
    if (
      dto.sectionId &&
      !(await this.assignmentsRepository.sectionExists(dto.sectionId))
    ) {
      throw new BadRequestException('Unknown section id');
    }
    if (
      dto.subjectId &&
      !(await this.assignmentsRepository.subjectExists(dto.subjectId))
    ) {
      throw new BadRequestException('Unknown subject id');
    }
    if (
      dto.academicSessionId &&
      !(await this.assignmentsRepository.sessionExists(dto.academicSessionId))
    ) {
      throw new BadRequestException('Unknown academic session id');
    }
  }
}
