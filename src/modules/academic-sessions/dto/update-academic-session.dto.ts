import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAcademicSessionDto } from './create-academic-session.dto';

// isActive আলাদা activate/deactivate endpoint দিয়ে বদলানো হয়, তাই এখানে বাদ
export class UpdateAcademicSessionDto extends PartialType(
  OmitType(CreateAcademicSessionDto, ['isActive'] as const),
) {}
