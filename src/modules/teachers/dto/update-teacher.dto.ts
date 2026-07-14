import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTeacherDto } from './create-teacher.dto';

// userId change করা যাবে না — teacher তৈরির সময়ই fix হয়
export class UpdateTeacherDto extends PartialType(
  OmitType(CreateTeacherDto, ['userId'] as const),
) {}
