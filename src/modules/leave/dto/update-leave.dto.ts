import { PartialType } from '@nestjs/swagger';
import { CreateLeaveDto } from './create-leave.dto';

/** শুধু PENDING leave আপডেট করা যায় (owner)। */
export class UpdateLeaveDto extends PartialType(CreateLeaveDto) {}
