import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { ClassesService } from '../classes/classes.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { QuerySectionsDto } from './dto/query-sections.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { Section } from './entities/section.entity';
import { SectionsRepository } from './sections.repository';

export interface SectionOccupancy {
  sectionId: string;
  maxCapacity: number | null;
  enrolled: number;
  available: number | null;
  isFull: boolean;
}

@Injectable()
export class SectionsService {
  constructor(
    private readonly sectionsRepository: SectionsRepository,
    private readonly classesService: ClassesService,
  ) {}

  async create(dto: CreateSectionDto): Promise<Section> {
    // parent class আছে কিনা যাচাই (না থাকলে NotFound)
    await this.classesService.findOne(dto.classId);
    const section = this.sectionsRepository.create(dto);
    return this.sectionsRepository.save(section);
  }

  async findAll(query: QuerySectionsDto) {
    const [data, total] = await this.sectionsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Section> {
    const section = await this.sectionsRepository.findById(id);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    return section;
  }

  /** section-এর ধারণক্ষমতা vs ভর্তি সংখ্যা। */
  async getOccupancy(id: string): Promise<SectionOccupancy> {
    const section = await this.findOne(id);
    const enrolled = await this.sectionsRepository.countEnrollments(id);
    const maxCapacity = section.maxCapacity;
    return {
      sectionId: section.id,
      maxCapacity,
      enrolled,
      available: maxCapacity === null ? null : maxCapacity - enrolled,
      isFull: maxCapacity === null ? false : enrolled >= maxCapacity,
    };
  }

  async update(id: string, dto: UpdateSectionDto): Promise<Section> {
    const section = await this.findOne(id);
    if (dto.classId) {
      await this.classesService.findOne(dto.classId);
    }
    Object.assign(section, dto);
    return this.sectionsRepository.save(section);
  }

  async remove(id: string): Promise<{ message: string }> {
    const section = await this.findOne(id);
    await this.sectionsRepository.remove(section);
    return { message: 'Section deleted successfully' };
  }
}
