import { Injectable } from '@nestjs/common';
import { badRequest, notFound } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { FindPermissionsQueryDto } from './dto/find-permissions-query.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

type PermissionSortField = 'id' | 'moduleId' | 'action' | 'createdAt' | 'updatedAt';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private handlePermissionWriteError(error: unknown): never {
    const prismaError = error as { code?: string };

    if (prismaError?.code === 'P2002') {
      throw badRequest(
        'Permission already exists for this module',
        ERROR_CODES.PERMISSION_ALREADY_EXISTS,
      );
    }

    if (prismaError?.code === 'P2003') {
      throw badRequest(
        'Invalid related entity reference',
        ERROR_CODES.INVALID_RELATION_REFERENCE,
      );
    }

    if (prismaError?.code === 'P2025') {
      throw notFound('Permission not found', ERROR_CODES.PERMISSION_NOT_FOUND);
    }

    throw error;
  }

  async create(dto: CreatePermissionDto) {
    await this.ensureModuleExists(dto.moduleId);
    const existing = await this.prisma.permission.findUnique({
      where: {
        moduleId_action: {
          moduleId: dto.moduleId,
          action: dto.action,
        },
      },
      select: { id: true },
    });

    try {
      const result = await this.prisma.permission.upsert({
        where: {
          moduleId_action: {
            moduleId: dto.moduleId,
            action: dto.action,
          },
        },
        update: {
          updatedAt: new Date(),
        },
        create: {
          moduleId: dto.moduleId,
          action: dto.action,
        },
        include: {
          module: true,
        },
      });

      await this.ensurePermissionAssignedToRootRoles(result.id);

      this.realtimeService.emitCrudEvent(
        'permissions',
        existing ? 'updated' : 'created',
        result,
      );
      return result;
    } catch (error) {
      this.handlePermissionWriteError(error);
    }
  }

  async findAll(query?: FindPermissionsQueryDto) {
    const action = query?.action?.trim();
    const search = query?.search?.trim();
    const sortBy: PermissionSortField | undefined = query?.sortBy;
    const sortOrder: 'asc' | 'desc' = query?.sortOrder ?? 'asc';
    const orderBy = sortBy
      ? [{ [sortBy]: sortOrder }, { id: 'asc' as const }]
      : [{ moduleId: 'asc' as const }, { action: 'asc' as const }];

    return this.prisma.permission.findMany({
      where: {
        ...(query?.id !== undefined ? { id: query.id } : {}),
        ...(query?.moduleId !== undefined ? { moduleId: query.moduleId } : {}),
        ...(action
          ? { action: { contains: action, mode: 'insensitive' } }
          : {}),
        ...(search
          ? {
              OR: [
                { action: { contains: search, mode: 'insensitive' } },
                { module: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { module: true },
      orderBy,
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.permission.findUnique({
      where: { id },
      include: { module: true },
    });

    if (!item) {
      throw notFound('Permission not found', ERROR_CODES.PERMISSION_NOT_FOUND);
    }

    return item;
  }

  async update(id: number, dto: UpdatePermissionDto) {
    if (dto.moduleId === undefined && dto.action === undefined) {
      throw badRequest(
        'At least one field must be provided for update',
        ERROR_CODES.EMPTY_UPDATE_PAYLOAD,
      );
    }

    await this.findOne(id);

    if (dto.moduleId !== undefined) {
      await this.ensureModuleExists(dto.moduleId);
    }

    try {
      const updated = await this.prisma.permission.update({
        where: { id },
        data: {
          ...(dto.moduleId !== undefined ? { moduleId: dto.moduleId } : {}),
          ...(dto.action !== undefined ? { action: dto.action } : {}),
        },
        include: { module: true },
      });

      this.realtimeService.emitCrudEvent('permissions', 'updated', updated);
      return updated;
    } catch (error) {
      this.handlePermissionWriteError(error);
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.rolePermission.deleteMany({ where: { permissionId: id } });
    try {
      const deleted = await this.prisma.permission.delete({ where: { id } });
      this.realtimeService.emitCrudEvent('permissions', 'deleted', deleted);
      return deleted;
    } catch (error) {
      this.handlePermissionWriteError(error);
    }
  }

  private async ensureModuleExists(moduleId: number) {
    const moduleItem = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true },
    });

    if (!moduleItem) {
      throw notFound('Module not found', ERROR_CODES.MODULE_NOT_FOUND);
    }
  }

  private async ensurePermissionAssignedToRootRoles(permissionId: number) {
    const rootRoles = await this.prisma.role.findMany({
      where: { isRoot: true },
      select: { id: true },
    });

    if (rootRoles.length === 0) {
      return;
    }

    await this.prisma.rolePermission.createMany({
      data: rootRoles.map((role) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }
}
