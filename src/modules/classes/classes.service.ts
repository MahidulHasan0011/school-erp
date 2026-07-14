import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { ClassesRepository } from './classes.repository';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassEntity } from './entities/class.entity';

@Injectable()
export class ClassesService {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async create(dto: CreateClassDto): Promise<ClassEntity> {
    const existing = await this.classesRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Class name already exists');
    }
    const entity = this.classesRepository.create(dto);
    return this.classesRepository.save(entity);
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.classesRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<ClassEntity> {
    const entity = await this.classesRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Class not found');
    }
    return entity;
  }

  async findWithSections(id: string): Promise<ClassEntity> {
    const entity = await this.classesRepository.findByIdWithSections(id);
    if (!entity) {
      throw new NotFoundException('Class not found');
    }
    return entity;
  }

  async update(id: string, dto: UpdateClassDto): Promise<ClassEntity> {
    const entity = await this.findOne(id);
    if (dto.name && dto.name !== entity.name) {
      const clash = await this.classesRepository.findByName(dto.name);
      if (clash) {
        throw new ConflictException('Class name already exists');
      }
    }
    Object.assign(entity, dto);
    return this.classesRepository.save(entity);
  }

  async remove(id: string): Promise<{ message: string }> {
    const entity = await this.findOne(id);
    await this.classesRepository.remove(entity);
    return { message: 'Class deleted successfully' };
  }
}
