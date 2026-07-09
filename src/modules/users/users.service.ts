import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';

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
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({ ...dto, password: passwordHash });
    return this.stripPassword(await this.usersRepository.save(user));
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await this.usersRepository.findAndCount({
      skip: query.skip,
      take: query.limit,
      order: { createdAt: query.order },
    });
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
