import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { paginate } from '../../common/utils/pagination.util';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { GenerateUrlDto } from './dto/generate-url.dto';
import { QueryUploadsDto } from './dto/query-uploads.dto';
import { UploadAction } from './entities/upload-audit-log.entity';
import { Upload, UploadStatus } from './entities/upload.entity';
import { StorageService } from './storage.service';
import { UploadsRepository } from './uploads.repository';

/** controller থেকে আসা actor + request context (audit-এর জন্য)। */
interface ActionContext {
  actorId: string;
  ip?: string;
  userAgent?: string;
}

/** presigned URL-এর মেয়াদ (সেকেন্ড) — response-এ ক্লায়েন্টকে জানানোর জন্য। */
const URL_EXPIRES_IN = 900;

@Injectable()
export class UploadsService {
  constructor(
    private readonly uploadsRepository: UploadsRepository,
    private readonly storageService: StorageService,
  ) {}

  /** STEP 1 — PENDING row তৈরি করে client-এর জন্য presigned PUT URL ফেরত দেয়। */
  async generateUrl(dto: GenerateUrlDto, ctx: ActionContext) {
    const extension = this.extractExtension(dto.originalName);
    const storageKey = `${dto.category.toLowerCase()}/${randomUUID()}.${extension}`;

    const upload = await this.uploadsRepository.save(
      this.uploadsRepository.create({
        storageKey,
        originalName: dto.originalName,
        mimeType: dto.mimeType,
        extension,
        fileSize: dto.fileSize,
        category: dto.category,
        status: UploadStatus.PENDING,
        uploadedBy: ctx.actorId,
        checksum: dto.checksum ?? null,
        metadata: dto.metadata ?? {},
        relatedType: dto.relatedType ?? null,
        relatedId: dto.relatedId ?? null,
      }),
    );

    const uploadUrl = await this.storageService.getUploadUrl(
      storageKey,
      dto.mimeType,
      URL_EXPIRES_IN,
    );

    await this.audit(upload.id, UploadAction.GENERATE_URL, ctx, {
      category: dto.category,
      fileSize: dto.fileSize,
    });

    return {
      uploadId: upload.id,
      storageKey,
      uploadUrl,
      expiresIn: URL_EXPIRES_IN,
      method: 'PUT',
    };
  }

  /**
   * STEP 2 — client S3-তে upload শেষ করলে row-কে READY করে।
   * আগে headObject দিয়ে যাচাই: object সত্যিই আছে কিনা। না থাকলে FAILED + 400।
   * থাকলে আসল file size/etag রেকর্ড করে READY করা হয়।
   */
  async confirm(dto: ConfirmUploadDto, ctx: ActionContext): Promise<Upload> {
    const upload = await this.findOne(dto.id);

    const head = await this.storageService.headObject(upload.storageKey);
    if (!head) {
      upload.status = UploadStatus.FAILED;
      await this.uploadsRepository.save(upload);
      await this.audit(upload.id, UploadAction.CONFIRM, ctx, {
        result: 'missing-object',
      });
      throw new BadRequestException('Uploaded file not found in storage');
    }

    // storage-এর প্রকৃত size দিয়ে reconcile
    upload.fileSize = head.contentLength || upload.fileSize;
    upload.status = UploadStatus.READY;
    const saved = await this.uploadsRepository.save(upload);
    await this.audit(saved.id, UploadAction.CONFIRM, ctx, {
      etag: head.etag,
      fileSize: saved.fileSize,
    });
    return saved;
  }

  async findAll(query: QueryUploadsDto) {
    const [data, total] = await this.uploadsRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Upload> {
    const upload = await this.uploadsRepository.findById(id);
    if (!upload) {
      throw new NotFoundException('Upload not found');
    }
    return upload;
  }

  /** presigned GET URL — শুধু READY ফাইলের জন্য। */
  async download(id: string, ctx: ActionContext) {
    const upload = await this.findOne(id);
    if (upload.status !== UploadStatus.READY) {
      throw new BadRequestException('File is not ready for download');
    }
    const url = await this.storageService.getDownloadUrl(
      upload.storageKey,
      upload.originalName,
      URL_EXPIRES_IN,
    );
    await this.audit(upload.id, UploadAction.DOWNLOAD, ctx);
    return { url, expiresIn: URL_EXPIRES_IN };
  }

  async remove(id: string, ctx: ActionContext): Promise<{ message: string }> {
    const upload = await this.findOne(id);
    await this.uploadsRepository.softRemoveMany([upload]);
    await this.audit(upload.id, UploadAction.DELETE, ctx);
    return { message: 'Upload deleted successfully' };
  }

  async bulkDelete(
    dto: BulkDeleteDto,
    ctx: ActionContext,
  ): Promise<{ message: string; deleted: number }> {
    const uploads = await this.uploadsRepository.findByIds(dto.ids);
    if (uploads.length === 0) {
      throw new NotFoundException('No matching uploads found');
    }
    await this.uploadsRepository.softRemoveMany(uploads);
    for (const upload of uploads) {
      await this.audit(upload.id, UploadAction.DELETE, ctx, { bulk: true });
    }
    return { message: 'Uploads deleted', deleted: uploads.length };
  }

  async restore(id: string, ctx: ActionContext): Promise<Upload> {
    const upload = await this.uploadsRepository.findByIdWithDeleted(id);
    if (!upload) {
      throw new NotFoundException('Upload not found');
    }
    if (!upload.deletedAt) {
      throw new BadRequestException('Upload is not deleted');
    }
    const restored = await this.uploadsRepository.recover(upload);
    await this.audit(restored.id, UploadAction.RESTORE, ctx);
    return restored;
  }

  // ── helpers ──

  private audit(
    uploadId: string,
    action: UploadAction,
    ctx: ActionContext,
    detail: Record<string, unknown> = {},
  ): Promise<void> {
    return this.uploadsRepository.logAudit({
      uploadId,
      action,
      actorId: ctx.actorId,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      detail,
    });
  }

  /** original নাম থেকে extension বের করে (না থাকলে 'bin')। */
  private extractExtension(originalName: string): string {
    const dot = originalName.lastIndexOf('.');
    if (dot < 0 || dot === originalName.length - 1) {
      return 'bin';
    }
    return originalName.slice(dot + 1).toLowerCase();
  }
}
