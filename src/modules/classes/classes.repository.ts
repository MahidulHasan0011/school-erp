import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { safeSortColumn } from '../../common/utils/order.util';
import { applySearch, applyPagination } from '../../common/utils/query-builder.util';
import { ClassEntity } from './entities/class.entity';

const SORTABLE_COLUMNS = ['name', 'createdAt', 'updatedAt'];

@Injectable()
export class ClassesRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
  ) {}

  create(data: Partial<ClassEntity>): ClassEntity {
    return this.repo.create(data);
  }

  save(entity: ClassEntity): Promise<ClassEntity> {
    return this.repo.save(entity);
  }

  findById(id: string): Promise<ClassEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(name: string): Promise<ClassEntity | null> {
    return this.repo.findOne({ where: { name } });
  }

  /** class + তার সব section। */
  findByIdWithSections(id: string): Promise<ClassEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: { sections: true },
    });
  }

  findPaginated(query: PaginationDto): Promise<[ClassEntity[], number]> {
    const qb = this.repo.createQueryBuilder('class');

    applySearch(qb, 'class', ['name'], query.search);

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'name');
    applyPagination(qb, 'class', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async remove(entity: ClassEntity): Promise<void> {
    await this.repo.softRemove(entity);
  }
}
