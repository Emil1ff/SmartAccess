import {
  Injectable,
} from '@nestjs/common';
import { badRequest, notFound } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { FindModulesQueryDto } from './dto/find-modules-query.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

type ModuleSortField = 'id' | 'name' | 'createdAt' | 'updatedAt';

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private handleModuleWriteError(error: unknown): never {
    const prismaError = error as { code?: string; meta?: { target?: unknown } };

    if (prismaError?.code === 'P2002') {
      throw badRequest('Module name already exists', ERROR_CODES.MODULE_NAME_EXISTS);
    }

    if (prismaError?.code === 'P2025') {
      throw notFound('Module not found', ERROR_CODES.MODULE_NOT_FOUND);
    }

    throw error;
  }

  async create(dto: CreateModuleDto) {
    try {
      const created = await this.prisma.module.create({ data: dto });
      this.realtimeService.emitCrudEvent('modules', 'created', created);
      return created;
    } catch (error) {
      this.handleModuleWriteError(error);
    }
  }

  async findAll(query?: FindModulesQueryDto) {
    const andFilters: Array<Record<string, unknown>> = [];

    if (query?.id !== undefined) {
      andFilters.push({ id: query.id });
    }

    if (query?.name?.trim()) {
      andFilters.push({
        name: { contains: query.name.trim(), mode: 'insensitive' as const },
      });
    }

    if (query?.search?.trim()) {
      andFilters.push({
        name: { contains: query.search.trim(), mode: 'insensitive' as const },
      });
    }

    const where = andFilters.length > 0 ? { AND: andFilters } : {};
    const sortBy: ModuleSortField = query?.sortBy ?? 'id';
    const sortOrder: 'asc' | 'desc' = query?.sortOrder ?? 'asc';

    return this.prisma.module.findMany({ where, orderBy: { [sortBy]: sortOrder } });
  }

  async findOne(id: number) {
    const item = await this.prisma.module.findUnique({ where: { id } });
    if (!item) {
      throw notFound('Module not found', ERROR_CODES.MODULE_NOT_FOUND);
    }

    return item;
  }

  async findByName(name: string) {
    return this.prisma.module.findUnique({ where: { name } });
  }

  async update(id: number, dto: UpdateModuleDto) {
    if (dto.name === undefined) {
      throw badRequest(
        'At least one field must be provided for update',
        ERROR_CODES.EMPTY_UPDATE_PAYLOAD,
      );
    }

    await this.findOne(id);
    try {
      const updated = await this.prisma.module.update({ where: { id }, data: dto });
      this.realtimeService.emitCrudEvent('modules', 'updated', updated);
      return updated;
    } catch (error) {
      this.handleModuleWriteError(error);
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      const { deletedModule, deletedPermissions } = await this.prisma.$transaction(
        async (tx) => {
          const permissionIds = await tx.permission.findMany({
            where: { moduleId: id },
            select: { id: true },
          });

          const ids = permissionIds.map((item) => item.id);

          if (ids.length > 0) {
            await tx.rolePermission.deleteMany({
              where: { permissionId: { in: ids } },
            });
          }

          const deletedPermissions = await tx.permission.deleteMany({
            where: { moduleId: id },
          });

          const deletedModule = await tx.module.delete({ where: { id } });

          return { deletedModule, deletedPermissions: ids };
        },
      );

      for (const permissionId of deletedPermissions) {
        this.realtimeService.emitCrudEvent('permissions', 'deleted', {
          id: permissionId,
          moduleId: id,
        });
      }

      const deleted = deletedModule;
      this.realtimeService.emitCrudEvent('modules', 'deleted', deleted);
      return deleted;
    } catch (error) {
      this.handleModuleWriteError(error);
    }
  }
}
