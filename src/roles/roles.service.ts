import {
  Injectable,
} from '@nestjs/common';
import { badRequest, forbidden, notFound } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { FindRolesQueryDto } from './dto/find-roles-query.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

type RoleSortField = 'id' | 'name' | 'isRoot' | 'createdAt' | 'updatedAt';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private handleRoleWriteError(error: unknown): never {
    const prismaError = error as { code?: string };

    if (prismaError?.code === 'P2002') {
      throw badRequest('Role name already exists', ERROR_CODES.ROLE_NAME_EXISTS);
    }

    if (prismaError?.code === 'P2025') {
      throw notFound('Role not found', ERROR_CODES.ROLE_NOT_FOUND);
    }

    throw error;
  }

  async create(dto: CreateRoleDto) {
    try {
      const created = await this.prisma.role.create({
        data: {
          name: dto.name,
          isRoot: dto.isRoot ?? false,
        },
      });

      this.realtimeService.emitCrudEvent('roles', 'created', created);
      return created;
    } catch (error) {
      this.handleRoleWriteError(error);
    }
  }

  async findAll(query?: FindRolesQueryDto) {
    const name = query?.name?.trim();
    const search = query?.search?.trim();
    const andFilters: Array<Record<string, unknown>> = [];

    if (query?.id !== undefined) {
      andFilters.push({ id: query.id });
    }

    if (query?.isRoot !== undefined) {
      andFilters.push({ isRoot: query.isRoot });
    }

    if (name) {
      andFilters.push({
        name: { contains: name, mode: 'insensitive' },
      });
    }

    if (search) {
      andFilters.push({
        name: { contains: search, mode: 'insensitive' },
      });
    }

    const sortBy: RoleSortField = query?.sortBy ?? 'id';
    const sortOrder: 'asc' | 'desc' = query?.sortOrder ?? 'asc';

    return this.prisma.role.findMany({
      where: andFilters.length > 0 ? { AND: andFilters } : {},
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
      orderBy: { [sortBy]: sortOrder },
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.role.findUnique({
      where: { id },
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
    });

    if (!item) {
      throw notFound('Role not found', ERROR_CODES.ROLE_NOT_FOUND);
    }

    return item;
  }

  async update(id: number, dto: UpdateRoleDto, actorRoleId?: number) {
    if (dto.name === undefined && dto.isRoot === undefined) {
      throw badRequest(
        'At least one field must be provided for update',
        ERROR_CODES.EMPTY_UPDATE_PAYLOAD,
      );
    }

    if (actorRoleId !== undefined && actorRoleId === id) {
      throw forbidden(
        'You cannot modify your own role',
        ERROR_CODES.SELF_ROLE_MODIFICATION_FORBIDDEN,
      );
    }

    const role = await this.findOne(id);

    if (role.isRoot && dto.isRoot === false) {
      throw badRequest(
        'Root role cannot be downgraded',
        ERROR_CODES.ROOT_ROLE_CANNOT_BE_DOWNGRADED,
      );
    }

    try {
      const updated = await this.prisma.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isRoot !== undefined ? { isRoot: dto.isRoot } : {}),
        },
      });

      this.realtimeService.emitCrudEvent('roles', 'updated', updated);
      return updated;
    } catch (error) {
      this.handleRoleWriteError(error);
    }
  }

  async remove(id: number, actorRoleId?: number) {
    if (actorRoleId !== undefined && actorRoleId === id) {
      throw forbidden(
        'You cannot modify your own role',
        ERROR_CODES.SELF_ROLE_MODIFICATION_FORBIDDEN,
      );
    }

    const role = await this.findOne(id);

    if (role.isRoot) {
      throw badRequest('Root role cannot be deleted', ERROR_CODES.ROOT_ROLE_CANNOT_BE_DELETED);
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    try {
      const deleted = await this.prisma.role.delete({ where: { id } });
      this.realtimeService.emitCrudEvent('roles', 'deleted', deleted);
      return deleted;
    } catch (error) {
      this.handleRoleWriteError(error);
    }
  }

  async setPermissions(roleId: number, dto: SetRolePermissionsDto, actorRoleId?: number) {
    if (actorRoleId !== undefined && actorRoleId === roleId) {
      throw forbidden(
        'You cannot modify permissions of your own role',
        ERROR_CODES.SELF_ROLE_MODIFICATION_FORBIDDEN,
      );
    }

    const role = await this.findOne(roleId);
    const uniquePermissionIds = Array.from(new Set(dto.permissionIds));

    if (role.isRoot) {
      throw badRequest(
        'Root role has all permissions implicitly and cannot be manually edited',
        ERROR_CODES.ROOT_ROLE_PERMISSIONS_IMPLICIT,
      );
    }

    const foundPermissions = await this.prisma.permission.findMany({
      where: { id: { in: uniquePermissionIds } },
      select: { id: true },
    });

    if (foundPermissions.length !== uniquePermissionIds.length) {
      throw notFound('One or more permissions not found', ERROR_CODES.PERMISSION_NOT_FOUND);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });

      await tx.rolePermission.createMany({
        data: uniquePermissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    });

    const updated = await this.findOne(roleId);
    this.realtimeService.emitCrudEvent('roles', 'updated', updated);
    return updated;
  }
}
