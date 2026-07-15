import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { calculateGrade } from '../../common/utils/grade.util';
import { ExamStatus } from '../exams/entities/exam.entity';
import { ExamsRepository } from '../exams/exams.repository';
import { BulkCreateExamResultDto } from './dto/bulk-create-exam-result.dto';
import { CreateExamResultDto } from './dto/create-exam-result.dto';
import { QueryExamResultsDto } from './dto/query-exam-results.dto';
import { UpdateExamResultDto } from './dto/update-exam-result.dto';
import { ExamResult } from './entities/exam-result.entity';
import { ExamResultsRepository } from './exam-results.repository';

@Injectable()
export class ExamResultsService {
  constructor(
    private readonly resultsRepository: ExamResultsRepository,
    private readonly examsRepository: ExamsRepository,
  ) {}

  async create(dto: CreateExamResultDto): Promise<ExamResult> {
    const exam = await this.examsRepository.findById(dto.examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    // published হলে সরাসরি modify করা যাবে না — আগে unpublish করতে হবে
    if (exam.status === ExamStatus.PUBLISHED) {
      throw new BadRequestException(
        'This exam is published — unpublish it first to modify results',
      );
    }
    if (!(await this.resultsRepository.studentExists(dto.studentId))) {
      throw new NotFoundException('Student not found');
    }
    if (!(await this.resultsRepository.subjectExists(dto.subjectId))) {
      throw new NotFoundException('Subject not found');
    }

    const existing = await this.resultsRepository.findByExamStudentSubject(
      dto.examId,
      dto.studentId,
      dto.subjectId,
    );
    if (existing) {
      throw new ConflictException(
        'Result already exists for this exam/student/subject — use update instead',
      );
    }

    const result = this.resultsRepository.create({
      ...dto,
      grade: calculateGrade(dto.marks),
    });
    return this.resultsRepository.save(result);
  }

  async bulkCreate(dto: BulkCreateExamResultDto) {
    const exam = await this.examsRepository.findById(dto.examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    if (exam.status === ExamStatus.PUBLISHED) {
      throw new BadRequestException(
        'This exam is published — unpublish it first to modify results',
      );
    }

    const enriched = dto.entries.map((e) => ({
      examId: dto.examId,
      studentId: e.studentId,
      subjectId: e.subjectId,
      marks: e.marks,
      grade: calculateGrade(e.marks),
    }));

    const results = await this.resultsRepository.bulkUpsert(enriched);
    const completion = await this.checkAndReportCompletion(dto.examId);
    return { results, completion };
  }

  async findAll(query: QueryExamResultsDto) {
    const [data, total] = await this.resultsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<ExamResult> {
    const result = await this.resultsRepository.findById(id);
    if (!result) {
      throw new NotFoundException('Exam result not found');
    }
    return result;
  }

  async getByExam(examId: string): Promise<ExamResult[]> {
    const exam = await this.examsRepository.findById(examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return this.resultsRepository.findByExamId(examId);
  }

  /** marksheet — একজন student-এর একটি exam-এর সব বিষয়ের marks + grade + total। */
  async getMarksheet(examId: string, studentId: string) {
    const exam = await this.examsRepository.findById(examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    if (!(await this.resultsRepository.studentExists(studentId))) {
      throw new NotFoundException('Student not found');
    }

    const results = await this.resultsRepository.findByExamAndStudent(
      examId,
      studentId,
    );
    const totalMarks = results.reduce((sum, r) => sum + (r.marks ?? 0), 0);
    return { exam, studentId, results, totalMarks };
  }

  async update(id: string, dto: UpdateExamResultDto): Promise<ExamResult> {
    const result = await this.findOne(id);
    const exam = result.examId
      ? await this.examsRepository.findById(result.examId)
      : null;
    if (exam?.status === ExamStatus.PUBLISHED) {
      throw new BadRequestException(
        'This exam is published — unpublish it first to modify results',
      );
    }
    return this.resultsRepository.update(id, {
      marks: dto.marks,
      grade: calculateGrade(dto.marks),
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.findOne(id);
    const exam = result.examId
      ? await this.examsRepository.findById(result.examId)
      : null;
    if (exam?.status === ExamStatus.PUBLISHED) {
      throw new BadRequestException(
        'This exam is published — unpublish it first to delete results',
      );
    }
    await this.resultsRepository.remove(result);
    return { message: 'Result deleted successfully' };
  }

  /**
   * exam-এর সব enrolled student-এর result দেওয়া হয়েছে কিনা রিপোর্ট করে।
   * (auto-trigger hook পরে এখানে বসবে — এখন শুধু তথ্য দেয়, কিছু trigger করে না।)
   */
  async checkAndReportCompletion(examId: string) {
    const exam = await this.examsRepository.findById(examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    let isComplete = false;
    if (exam.classId && exam.academicSessionId) {
      const [withResults, enrolled] = await Promise.all([
        this.resultsRepository.countStudentsWithResults(examId),
        this.resultsRepository.countEnrolledStudents(
          exam.classId,
          exam.academicSessionId,
        ),
      ]);
      isComplete = enrolled > 0 && withResults >= enrolled;
    }

    return { examId, examType: exam.examType, isComplete };
  }
}