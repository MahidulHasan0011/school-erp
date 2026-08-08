import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Ranking সবসময় পুরো class + session-এর উপর চলে।
 *
 * এখানে `sectionId` নেই — ইচ্ছাকৃতভাবে। section হলো ranking-এর *ফলাফল*
 * (capacity অনুযায়ী বিতরণ), ইনপুট নয়। আর `ranking_history`-এর version পুরো
 * class+session ধরে গোনা হয়, তাই এক section-এর জন্য generate করলে সেই
 * version-এর snapshot-এ ক্লাসের বাকি ছাত্ররা হারিয়ে যেত।
 *
 * global ValidationPipe-এ `forbidNonWhitelisted: true` চালু আছে, তাই কেউ
 * `sectionId` পাঠালে পরিষ্কার 400 পাবে — নীরবে ভুল কাজ হবে না।
 */
export class GenerateRollDto {
  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiProperty({ description: 'Academic session UUID' })
  @IsUUID()
  academicSessionId: string;
}
