import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** presigned URL-এর ডিফল্ট মেয়াদ (সেকেন্ড) — ১৫ মিনিট। */
const DEFAULT_EXPIRES_IN = 900;

/**
 * S3/MinIO wrapper — pre-signed PUT/GET URL তৈরি ও object delete।
 * MinIO-এর জন্য custom endpoint + path-style; AWS হলে endpoint ফাঁকা রাখলেই চলবে।
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('storage.endpoint');
    this.bucket = this.config.get<string>('storage.bucket') ?? '';
    this.client = new S3Client({
      region: this.config.get<string>('storage.region') ?? 'us-east-1',
      // MinIO/custom endpoint হলে path-style আবশ্যক
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: this.config.get<string>('storage.accessKeyId') ?? '',
        secretAccessKey:
          this.config.get<string>('storage.secretAccessKey') ?? '',
      },
    });
  }

  /** client সরাসরি S3-তে ফাইল PUT করার presigned URL। */
  getUploadUrl(
    storageKey: string,
    mimeType: string,
    expiresIn = DEFAULT_EXPIRES_IN,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /** ফাইল download-এর presigned URL (attachment হিসেবে original নামে)। */
  getDownloadUrl(
    storageKey: string,
    originalName: string,
    expiresIn = DEFAULT_EXPIRES_IN,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${originalName}"`,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * S3-তে object আছে কিনা যাচাই + metadata ফেরত দেয়।
   * না থাকলে (404/NotFound) `null`; অন্য error হলে re-throw।
   * confirm step-এ ব্যবহার হয় — client সত্যিই upload করেছে কিনা নিশ্চিত করতে।
   */
  async headObject(storageKey: string): Promise<{
    contentLength: number;
    contentType: string | null;
    etag: string | null;
  } | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return {
        contentLength: Number(res.ContentLength ?? 0),
        contentType: res.ContentType ?? null,
        etag: res.ETag ? res.ETag.replaceAll('"', '') : null,
      };
    } catch (err) {
      const meta = err as {
        $metadata?: { httpStatusCode?: number };
        name?: string;
      };
      // 404/NotFound → object নেই; বাকি error re-throw
      if (
        meta?.$metadata?.httpStatusCode === 404 ||
        meta?.name === 'NotFound'
      ) {
        return null;
      }
      throw err;
    }
  }

  /** S3 থেকে object hard-delete (ব্যর্থ হলে throw করে না — log করে)। */
  async deleteObject(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
    } catch (err) {
      this.logger.warn(
        `S3 object delete ব্যর্থ (${storageKey}): ${(err as Error).message}`,
      );
    }
  }
}
