import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Prisma } from '../../generated/prisma';
import { badRequest, forbidden, notFound } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type SelfProfileUpdateInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  profileImage?: string;
  password?: string;
  birthDate?: Date;
  gender?: string;
};

type UserSortField =
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'birthDate'
  | 'createdAt'
  | 'updatedAt';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private handleUserWriteError(error: unknown): never {
    const prismaError = error as {
      code?: string;
      meta?: { target?: unknown; field_name?: unknown };
    };

    if (prismaError?.code === 'P2002') {
      const target = Array.isArray(prismaError.meta?.target)
        ? prismaError.meta.target.join(', ')
        : String(prismaError.meta?.target ?? 'field');

      if (target.includes('email')) {
        throw badRequest('Email already exists', ERROR_CODES.EMAIL_ALREADY_EXISTS);
      }

      throw badRequest(
        'Duplicate value for a unique field',
        ERROR_CODES.DUPLICATE_UNIQUE_VALUE,
      );
    }

    if (prismaError?.code === 'P2003') {
      const fieldName = String(prismaError.meta?.field_name ?? '');
      if (fieldName.includes('roleId')) {
        throw badRequest('Selected role does not exist', ERROR_CODES.SELECTED_ROLE_NOT_FOUND);
      }

      throw badRequest(
        'Invalid related entity reference',
        ERROR_CODES.INVALID_RELATION_REFERENCE,
      );
    }

    throw error;
  }

  async create(createUserDto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    try {
      const created = await this.prisma.user.create({
        data: {
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          email: createUserDto.email,
          phoneNumber: createUserDto.phoneNumber ?? null,
          profileImage: createUserDto.profileImage ?? null,
          password: passwordHash,
          birthDate: createUserDto.birthDate,
          gender: createUserDto.gender,
          roleId: createUserDto.roleId ?? null,
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              isRoot: true,
            },
          },
        },
      });

      this.realtimeService.emitCrudEvent('users', 'created', created);
      return created;
    } catch (error) {
      this.handleUserWriteError(error);
    }
  }

  async findAll(query?: FindUsersQueryDto) {
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const firstName = this.normalizeQueryValue(query?.firstName);
    const lastName = this.normalizeQueryValue(query?.lastName);
    const email = this.normalizeQueryValue(query?.email);
    const phoneNumber = this.normalizeQueryValue(query?.phoneNumber);
    const search = this.normalizeQueryValue(query?.search);

    const andFilters: Prisma.UserWhereInput[] = [];

    if (firstName) {
      andFilters.push({
        firstName: { contains: firstName, mode: 'insensitive' },
      });
    }

    if (lastName) {
      andFilters.push({
        lastName: { contains: lastName, mode: 'insensitive' },
      });
    }

    if (email) {
      andFilters.push({
        email: { equals: email, mode: 'insensitive' },
      });
    }

    if (phoneNumber) {
      andFilters.push({
        phoneNumber: { contains: phoneNumber, mode: 'insensitive' },
      });
    }

    if (query?.roleId !== undefined) {
      andFilters.push({ roleId: query.roleId });
    }

    if (search) {
      andFilters.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.UserWhereInput = andFilters.length
      ? { AND: andFilters }
      : {};

    const sortBy: UserSortField = query?.sortBy ?? 'id';
    const sortOrder: Prisma.SortOrder = query?.sortOrder ?? 'asc';

    const total = await this.prisma.user.count({ where });

    const data = await this.prisma.user.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        profileImage: true,
        birthDate: true,
        gender: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            isRoot: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 1 : Math.ceil(total / limit),
      },
    };
  }

  private normalizeQueryValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      const unquoted = trimmed.slice(1, -1).trim();
      return unquoted || undefined;
    }

    return trimmed;
  }

  async findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        profileImage: true,
        birthDate: true,
        gender: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            isRoot: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findProfileOrThrow(id: number) {
    const user = await this.findOne(id);
    if (!user) {
      throw notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto, actorUserId?: number) {
    if (
      updateUserDto.firstName === undefined &&
      updateUserDto.lastName === undefined &&
      updateUserDto.email === undefined &&
      updateUserDto.phoneNumber === undefined &&
      updateUserDto.profileImage === undefined &&
      updateUserDto.password === undefined &&
      updateUserDto.birthDate === undefined &&
      updateUserDto.gender === undefined &&
      updateUserDto.roleId === undefined
    ) {
      throw badRequest(
        'At least one field must be provided for update',
        ERROR_CODES.EMPTY_UPDATE_PAYLOAD,
      );
    }

    if (
      updateUserDto.roleId !== undefined &&
      actorUserId !== undefined &&
      actorUserId === id
    ) {
      throw forbidden(
        'You cannot change your own role assignment',
        ERROR_CODES.SELF_ROLE_ASSIGNMENT_FORBIDDEN,
      );
    }

    await this.findProfileOrThrow(id);

    const data: Prisma.UserUpdateInput = {};

    if (updateUserDto.firstName !== undefined) data.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined) data.lastName = updateUserDto.lastName;
    if (updateUserDto.email !== undefined) data.email = updateUserDto.email;
    if (updateUserDto.phoneNumber !== undefined) data.phoneNumber = updateUserDto.phoneNumber;
    if (updateUserDto.profileImage !== undefined) data.profileImage = updateUserDto.profileImage;
    if (updateUserDto.password !== undefined) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.birthDate !== undefined) data.birthDate = updateUserDto.birthDate;
    if (updateUserDto.gender !== undefined) data.gender = updateUserDto.gender;
    if (updateUserDto.roleId !== undefined) {
      data.role = { connect: { id: updateUserDto.roleId } };
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          profileImage: true,
          birthDate: true,
          gender: true,
          roleId: true,
          role: {
            select: {
              id: true,
              name: true,
              isRoot: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      this.realtimeService.emitCrudEvent('users', 'updated', updated);
      return updated;
    } catch (error) {
      this.handleUserWriteError(error);
    }
  }

  async updateSelfProfile(id: number, updateInput: SelfProfileUpdateInput) {
    if (
      updateInput.firstName === undefined &&
      updateInput.lastName === undefined &&
      updateInput.email === undefined &&
      updateInput.phoneNumber === undefined &&
      updateInput.profileImage === undefined &&
      updateInput.password === undefined &&
      updateInput.birthDate === undefined &&
      updateInput.gender === undefined
    ) {
      throw badRequest(
        'At least one field must be provided for update',
        ERROR_CODES.EMPTY_UPDATE_PAYLOAD,
      );
    }

    await this.findProfileOrThrow(id);

    const data: Prisma.UserUpdateInput = {};

    if (updateInput.firstName !== undefined) data.firstName = updateInput.firstName;
    if (updateInput.lastName !== undefined) data.lastName = updateInput.lastName;
    if (updateInput.email !== undefined) data.email = updateInput.email;
    if (updateInput.phoneNumber !== undefined) data.phoneNumber = updateInput.phoneNumber;
    if (updateInput.profileImage !== undefined) data.profileImage = updateInput.profileImage;
    if (updateInput.password !== undefined) {
      data.password = await bcrypt.hash(updateInput.password, 10);
    }
    if (updateInput.birthDate !== undefined) data.birthDate = updateInput.birthDate;
    if (updateInput.gender !== undefined) data.gender = updateInput.gender;

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          profileImage: true,
          birthDate: true,
          gender: true,
          roleId: true,
          role: {
            select: {
              id: true,
              name: true,
              isRoot: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      this.realtimeService.emitCrudEvent('users', 'updated', updated);
      return updated;
    } catch (error) {
      this.handleUserWriteError(error);
    }
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true },
    });

    if (!user) {
      throw notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    if (user.email === 'root@smarthub.az') {
      throw badRequest(
        'System root user cannot be deleted',
        ERROR_CODES.SYSTEM_ROOT_USER_DELETE_FORBIDDEN,
      );
    }

    const deleted = await this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        profileImage: true,
        birthDate: true,
        gender: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            isRoot: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    this.realtimeService.emitCrudEvent('users', 'deleted', deleted);
    return deleted;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByIdWithPermissions(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: {
                  include: {
                    module: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async clearRefreshTokenHash(id: number) {
    await this.prisma.user.update({
      where: { id },
      data: {
        refreshTokenHash: null,
      },
    });
  }

  async findByEmailWithPermissions(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: {
                  include: {
                    module: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findByLoginWithPermissions(login: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { phoneNumber: login }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: {
                  include: {
                    module: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async setRefreshTokenHash(userId: number, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }
}
