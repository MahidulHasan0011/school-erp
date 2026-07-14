import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStudentEnrollmentDto } from './create-student-enrollment.dto';

// studentId change করা যাবে না — ভুল student-এ enrollment সরে যাওয়া ঠেকাতে
export class UpdateStudentEnrollmentDto extends PartialType(
  OmitType(CreateStudentEnrollmentDto, ['studentId'] as const),
) {}
