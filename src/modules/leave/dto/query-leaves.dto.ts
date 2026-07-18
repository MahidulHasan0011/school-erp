import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LeaveStatus, LeaveType } from '../entities/leave.entity';

export class QueryLeavesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeaveStatus })
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @ApiPropertyOptional({ enum: LeaveType })
  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @ApiPropertyOptional({ description: 'নির্দিষ্ট user-এর leave (শুধু all-list-এ)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
