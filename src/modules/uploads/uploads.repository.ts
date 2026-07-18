import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { safeSortColumn } from '../../common/utils/order.util';
import {
  applyFilters,
  applyPagination,
  applySearch,
} from '../../common/utils/query-builder.util';
import { QueryUploadsDto } from './dto/query-uploads.dto';
import { UploadAuditLog } from './entities/upload-audit-log.entity';
import { Upload } from './entities/upload.entity';

const SORTABLE_COLUMNS = [
  'createdAt',
  'updatedAt',
  'originalName',
  'fileSize',
  'category',
];

@Injectable()
export class UploadsRepository {
  constructor(
    @InjectRepository(Upload)
    private readonly repo: Repository<Upload>,
    @InjectRepository(UploadAuditLog)
    private readonly auditRepo: Repository<UploadAuditLog>,
  ) {}

  create(data: Partial<Upload>): Upload {
    return this.repo.create(data);
  }

  save(upload: Upload): Promise<Upload> {
    return this.repo.save(upload);
  }

  findById(id: string): Promise<Upload | null> {
    return this.repo.findOne({ where: { id }, relations: { uploader: true } });
  }

  /** soft-deleted সহ (restore-এর জন্য)। */
  findByIdWithDeleted(id: string): Promise<Upload | null> {
    return this.repo.findOne({ where: { id }, withDeleted: true });
  }

  findByIds(ids: string[]): Promise<Upload[]> {
    return this.repo.find({ where: { id: In(ids) } });
  }

  findPaginated(query: QueryUploadsDto): Promise<[Upload[], number]> {
    const qb = this.repo
      .createQueryBuilder('upload')
      .leftJoinAndSelect('upload.uploader', 'uploader');

    applySearch(qb, 'upload', ['originalName'], query.search);
    applyFilters(qb, 'upload', {
      category: query.category,
      status: query.status,
      uploadedBy: query.uploadedBy,
      relatedType: query.relatedType,
      relatedId: query.relatedId,
    });

    const sortBy = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'createdAt');
    applyPagination(qb, 'upload', {
      skip: query.skip,
      limit: query.limit,
      sortBy,
      order: query.order,
    });

    return qb.getManyAndCount();
  }

  async softRemoveMany(uploads: Upload[]): Promise<void> {
    await this.repo.softRemove(uploads);
  }

  recover(upload: Upload): Promise<Upload> {
    return this.repo.recover(upload);
  }

  /** audit trail — কে/কখন/কোন IP থেকে কী action। */
  async logAudit(data: {
    uploadId: string;
    action: string;
    actorId: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    const entity = this.auditRepo.create({
      uploadId: data.uploadId,
      action: data.action,
      actorId: data.actorId,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      detail: data.detail ?? {},
    });
    await this.auditRepo.save(entity);
  }
}
