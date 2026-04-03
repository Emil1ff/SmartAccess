import {
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Role, User } from '../../generated/prisma';
import { forbidden, unauthorized } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { UsersService } from '../users/users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { SessionActivityService } from './session-activity.service';

type UserWithRoleAndPermissions = User & {
  role: (Role & {
    permissions: {
      permission: {
        action: string;
        module: {
          name: string;
        };
      };
    }[];
  }) | null;
};

const NO_RIGHTS_MESSAGE = 'Sizin bu sistemde huququnuz yoxdur';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionActivityService: SessionActivityService,
  ) {}

  async login(loginInput?: unknown, passwordInput?: unknown, rememberMeInput?: unknown) {
    const login = String(loginInput ?? '').trim();
    const password = String(passwordInput ?? '');
    const rememberMe = rememberMeInput === true;

    if (!login || !password) {
      throw unauthorized('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
    }

    const user = await this.usersService.findByLoginWithPermissions(login);
    if (!user) {
      throw unauthorized('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw unauthorized('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
    }

    return this.buildAuthResponse(user, rememberMe);
  }

  async me(userId: number) {
    const user = await this.usersService.findByIdWithPermissions(userId);

    if (!user) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    const permissions =
      user.role?.permissions.map(
        (item) => `${item.permission.module.name}:${item.permission.action}`,
      ) ?? [];

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profileImage: user.profileImage,
      birthDate: user.birthDate,
      gender: user.gender,
      roleId: user.roleId,
      isRoot: Boolean(user.role?.isRoot),
      permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async logout(userId: number, sessionId?: string) {
    await this.usersService.findProfileOrThrow(userId);

    await this.usersService.clearRefreshTokenHash(userId);
    this.sessionActivityService.clearSession(sessionId);

    return { success: true };
  }

  async updateMe(userId: number, updateMeDto: UpdateMeDto) {
    return this.usersService.updateSelfProfile(userId, updateMeDto);
  }

  private async buildAuthResponse(user: UserWithRoleAndPermissions, rememberMe: boolean) {
    if (!user.role) {
      throw forbidden(NO_RIGHTS_MESSAGE, ERROR_CODES.NO_SYSTEM_RIGHTS);
    }

    const sessionId = randomUUID();

    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      isRoot: user.role.isRoot,
      rememberMe,
      sessionId,
      permissions: user.role.permissions.map(
        (item) => `${item.permission.module.name}:${item.permission.action}`,
      ),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: rememberMe ? '30d' : '1d',
    });

    this.sessionActivityService.registerSession(sessionId);

    return {
      accessToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
        roleId: user.roleId,
        isRoot: user.role.isRoot,
      },
    };
  }
}
