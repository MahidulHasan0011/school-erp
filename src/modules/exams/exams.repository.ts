import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { AcademicSession } from '../academic-sessions/entities/academic-session.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { QueryExamsDto } from './dto/query-exams.dto';
import { Exam } from './entities/exam.entity';

const SORTABLE_COLUMNS = ['name', 'examDate', 'createdAt', 'updatedAt'];

@Injectable()
export class ExamsRepository {
  constructor(
    @InjectRepository(Exam)
    private readonly repo: Repository<Exam>,
  ) {}

  create(data: Partial<Exam>): Exam {
    return this.repo.create(data);
  }

  save(exam: Exam): Promise<Exam> {
    return this.repo.save(exam);
  }

  findById(id: string): Promise<Exam | null> {
    return this.repo.findOne({
      where: { id },
      relations: { class: true, academicSession: true },
    });
  }

  findPaginated(query: QueryExamsDto): Promise<[Exam[], number]> {
    const qb = this.repo
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.class', 'class')
      .leftJoinAndSelect('exam.academicSession', 'academicSession');

    applySearch(qb, 'exam', ['name'], query.search);
    applyFilters(qb, 'exam', {
      classId: query.classId,
      academicSessionId: query.academicSessionId,
      examType: query.examType,
      status: query.status,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'exam', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(exam: Exam): Promise<void> {
    await this.repo.softRemove(exam);
  }

  // ── FK existence checks ──
  classExists(id: string): Promise<boolean> {
    return this.exists(ClassEntity, id);
  }

  sessionExists(id: string): Promise<boolean> {
    return this.exists(AcademicSession, id);
  }

  private async exists<T extends ObjectLiteral>(
    target: EntityTarget<T>,
    id: string,
  ): Promise<boolean> {
    const count = await this.repo.manager.count(target, {
      where: { id } as never,
    });
    return count > 0;
  }
}
