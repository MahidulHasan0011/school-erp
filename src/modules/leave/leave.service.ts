import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate } from '../../common/utils/pagination.util';
import { NotificationType } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { QueryLeavesDto } from './dto/query-leaves.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { Leave, LeaveStatus } from './entities/leave.entity';
import { LeaveRepository } from './leave.repository';

@Injectable()
export class LeaveService {
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** নিজের leave apply — status PENDING। */
  async apply(dto: CreateLeaveDto, userId: string): Promise<Leave> {
    this.assertDateRange(dto.startDate, dto.endDate);
    const leave = this.leaveRepository.create({
      userId,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason ?? null,
      status: LeaveStatus.PENDING,
    });
    return this.leaveRepository.save(leave);
  }

  /** admin — সব leave (paginated + filter)। */
  async findAll(query: QueryLeavesDto) {
    const [data, total] = await this.leaveRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  /** নিজের leave list। */
  async findMine(userId: string, query: QueryLeavesDto) {
    const [data, total] = await this.leaveRepository.findPaginated(
      query,
      userId,
    );
    return paginate(data, total, query.page, query.limit);
  }

  /** নিজের একটি leave (owner ছাড়া দেখা যাবে না)। */
  async findOneOwned(id: string, userId: string): Promise<Leave> {
    const leave = await this.getById(id);
    if (leave.userId !== userId) {
      throw new ForbiddenException('You can only view your own leave');
    }
    return leave;
  }

  /** owner + PENDING হলে আপডেট। */
  async update(
    id: string,
    dto: UpdateLeaveDto,
    userId: string,
  ): Promise<Leave> {
    const leave = await this.findOneOwned(id, userId);
    this.assertPending(leave);
    const startDate = dto.startDate ?? leave.startDate ?? undefined;
    const endDate = dto.endDate ?? leave.endDate ?? undefined;
    if (startDate && endDate) {
      this.assertDateRange(startDate, endDate);
    }
    Object.assign(leave, dto);
    return this.leaveRepository.save(leave);
  }

  /** owner + PENDING হলে cancel। */
  async cancel(id: string, userId: string): Promise<Leave> {
    const leave = await this.findOneOwned(id, userId);
    this.assertPending(leave);
    leave.status = LeaveStatus.CANCELLED;
    return this.leaveRepository.save(leave);
  }

  /** admin — approve (PENDING → APPROVED) + owner-কে notify। */
  async approve(id: string, approverId: string): Promise<Leave> {
    return this.decide(id, LeaveStatus.APPROVED, approverId);
  }

  /** admin — reject (PENDING → REJECTED) + owner-কে notify। */
  async reject(
    id: string,
    approverId: string,
    dto: RejectLeaveDto,
  ): Promise<Leave> {
    return this.decide(id, LeaveStatus.REJECTED, approverId, dto.note);
  }

  /** admin — soft delete। */
  async remove(id: string): Promise<{ message: string }> {
    const leave = await this.getById(id);
    await this.leaveRepository.remove(leave);
    return { message: 'Leave deleted successfully' };
  }

  // ── helpers ──

  private async decide(
    id: string,
    status: LeaveStatus.APPROVED | LeaveStatus.REJECTED,
    approverId: string,
    note?: string,
  ): Promise<Leave> {
    const leave = await this.getById(id);
    this.assertPending(leave);
    leave.status = status;
    const saved = await this.leaveRepository.save(leave);

    // owner-কে notify (leave-এর user_id থাকলে)
    // NOTE: title/message DB-তে persist হয় ও user দেখে — তাই English (data, comment নয়)
    if (saved.userId) {
      const verb = status === LeaveStatus.APPROVED ? 'approved' : 'rejected';
      await this.notificationsService.notify({
        recipientId: saved.userId,
        type: NotificationType.LEAVE,
        title: `Your leave request was ${verb}`,
        message: note
          ? `${saved.startDate} – ${saved.endDate}: ${verb}. Note: ${note}`
          : `${saved.startDate} – ${saved.endDate}: ${verb}.`,
        relatedType: 'leave',
        relatedId: saved.id,
        createdBy: approverId,
      });
    }
    return saved;
  }

  private async getById(id: string): Promise<Leave> {
    const leave = await this.leaveRepository.findById(id);
    if (!leave) {
      throw new NotFoundException('Leave not found');
    }
    return leave;
  }

  private assertPending(leave: Leave): void {
    const status = leave.status as LeaveStatus;
    if (status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        `Only PENDING leave can be modified (current: ${status})`,
      );
    }
  }

  private assertDateRange(startDate: string, endDate: string): void {
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
  }
}
