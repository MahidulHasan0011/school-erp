import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { AcademicSessionsRepository } from './academic-sessions.repository';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';
import { AcademicSession } from './entities/academic-session.entity';

@Injectable()
export class AcademicSessionsService {
  constructor(private readonly sessionsRepository: AcademicSessionsRepository) {}

  async create(dto: CreateAcademicSessionDto): Promise<AcademicSession> {
    const existing = await this.sessionsRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Academic session name already exists');
    }
    const session = this.sessionsRepository.create(dto);
    const saved = await this.sessionsRepository.save(session);
    // create-এর সময় active চাইলে single-active নিশ্চিত করি
    if (dto.isActive) {
      await this.sessionsRepository.setActive(saved.id);
      return this.findOne(saved.id);
    }
    return saved;
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.sessionsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  /** বর্তমান active session (না থাকলে null)। */
  getActive(): Promise<AcademicSession | null> {
    return this.sessionsRepository.findActive();
  }

  async findOne(id: string): Promise<AcademicSession> {
    const session = await this.sessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException('Academic session not found');
    }
    return session;
  }

  async update(
    id: string,
    dto: UpdateAcademicSessionDto,
  ): Promise<AcademicSession> {
    const session = await this.findOne(id);
    if (dto.name && dto.name !== session.name) {
      const clash = await this.sessionsRepository.findByName(dto.name);
      if (clash) {
        throw new ConflictException('Academic session name already exists');
      }
    }
    Object.assign(session, dto);
    return this.sessionsRepository.save(session);
  }

  async activate(id: string): Promise<AcademicSession> {
    await this.findOne(id);
    await this.sessionsRepository.setActive(id);
    return this.findOne(id);
  }

  async deactivate(id: string): Promise<AcademicSession> {
    const session = await this.findOne(id);
    session.isActive = false;
    return this.sessionsRepository.save(session);
  }

  async toggleAdmissionTest(id: string): Promise<AcademicSession> {
    const session = await this.findOne(id);
    session.admissionTestEnabled = !session.admissionTestEnabled;
    return this.sessionsRepository.save(session);
  }

  async remove(id: string): Promise<{ message: string }> {
    const session = await this.findOne(id);
    await this.sessionsRepository.remove(session);
    return { message: 'Academic session deleted successfully' };
  }
}
