import { PartialType } from '@nestjs/swagger';
import { CreateSubjectAssignmentDto } from './create-subject-assignment.dto';

export class UpdateSubjectAssignmentDto extends PartialType(
  CreateSubjectAssignmentDto,
) {}
