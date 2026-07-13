import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { paginate } from '../../common/utils/pagination.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findByEmailWithPassword(
      dto.email,
    );
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.usersRepository.create({ ...dto, password: passwordHash });
    return this.stripPassword(await this.usersRepository.save(user));
  }

  async findAll(query: QueryUsersDto) {
    const [data, total] = await this.usersRepository.findPaginated(query);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  /** নিজের পাসওয়ার্ড বদলানো — পুরনো পাসওয়ার্ড যাচাই করে। */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const matches = await bcrypt.compare(dto.oldPassword, user.password);
    if (!matches) {
      throw new BadRequestException('Old password is incorrect');
    }
    user.password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.save(user);
    return { message: 'Password changed successfully' };
  }

  /** Admin কর্তৃক পাসওয়ার্ড reset — পুরনো পাসওয়ার্ড ছাড়াই। */
  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.findOne(id);
    user.password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.save(user);
    return { message: 'Password reset successfully' };
  }

  /** user active/inactive toggle করে। */
  async toggleActive(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = !user.isActive;
    return this.stripPassword(await this.usersRepository.save(user));
  }

  /** JWT-তে embed করার জন্য user-এর roles + permissions। */
  getAccessControl(
    userId: string,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    return this.usersRepository.findAccessControl(userId);
  }

  /** For AuthService: validates credentials and returns the user (no password). */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersRepository.findByEmailWithPassword(email);
    if (!user) {
      return null;
    }
    const matches = await bcrypt.compare(password, user.password);
    return matches ? this.stripPassword(user) : null;
  }

  private stripPassword(user: User): User {
    // Avoid leaking the hash even if the column was explicitly selected
    delete (user as Partial<User>).password;
    return user;
  }
}
