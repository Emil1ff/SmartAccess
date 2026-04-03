import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

type JwtUser = {
  sub: number;
};

type CachedAccess = {
  isRoot: boolean;
  permissions: Set<string>;
  expiresAt: number;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly accessCache = new Map<number, CachedAccess>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    const ttlSeconds = Number(process.env.AUTHZ_CACHE_TTL_SECONDS ?? 10);
    this.cacheTtlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? ttlSeconds * 1000
      : 10000;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;

    if (!user?.sub) {
      return false;
    }

    const access = await this.getEffectiveAccess(user.sub);
    if (!access) {
      return false;
    }

    if (access.isRoot) {
      return true;
    }

    return requiredPermissions.some((permission) =>
      access.permissions.has(permission),
    );
  }

  private async getEffectiveAccess(userId: number): Promise<CachedAccess | null> {
    const now = Date.now();
    const cached = this.accessCache.get(userId);

    if (cached && cached.expiresAt > now) {
      return cached;
    }

    const userWithRole = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!userWithRole?.role) {
      this.accessCache.delete(userId);
      return null;
    }

    const result: CachedAccess = {
      isRoot: userWithRole.role.isRoot,
      permissions: new Set(
        userWithRole.role.permissions.map(
          (item) => `${item.permission.module.name}:${item.permission.action}`,
        ),
      ),
      expiresAt: now + this.cacheTtlMs,
    };

    this.accessCache.set(userId, result);
    return result;
  }
}
