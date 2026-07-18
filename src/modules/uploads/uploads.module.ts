import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadAuditLog } from './entities/upload-audit-log.entity';
import { Upload } from './entities/upload.entity';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';
import { UploadsRepository } from './uploads.repository';
import { UploadsService } from './uploads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Upload, UploadAuditLog])],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsRepository, StorageService],
  exports: [UploadsService, UploadsRepository],
})
export class UploadsModule {}
