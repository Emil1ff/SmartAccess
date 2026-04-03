import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { unauthorized } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { ApiErrorResponses } from '../common/swagger/error-responses.decorator';
import { ApiSuccessResponse } from '../common/swagger/success-responses.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type JwtPayload = {
  sub: number;
  email: string;
  roleId: number;
  isRoot: boolean;
  permissions: string[];
  rememberMe?: boolean;
  sessionId?: string;
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email or phone number' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        login: {
          type: 'string',
          example: 'root@smarthub.az',
          description: 'Email or phone number',
        },
        password: {
          type: 'string',
          example: '12345678',
        },
        rememberMe: {
          type: 'boolean',
          example: false,
          description: 'Keep user logged in for long-lived sessions',
        },
      },
      required: ['login', 'password'],
    },
  })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Authenticated successfully',
    example: {
      accessToken: 'jwt-token-value',
      user: {
        id: 1,
        firstName: 'root',
        lastName: 'root',
        email: 'root@smarthub.az',
        roleId: 1,
        isRoot: true,
      },
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 401,
      errorCode: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid credentials',
    },
    {
      statusCode: 403,
      errorCode: ERROR_CODES.NO_SYSTEM_RIGHTS,
      message: 'Sizin bu sistemde huququnuz yoxdur',
    },
  )
  login(@Body() body: LoginDto) {
    return this.authService.login(body.login, body.password, body.rememberMe);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Current user profile',
    example: {
      id: 1,
      firstName: 'root',
      lastName: 'root',
      email: 'root@smarthub.az',
      phoneNumber: '+994501112233',
      birthDate: '2006-08-31T00:00:00.000Z',
      gender: 'other',
      roleId: 1,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 401,
      errorCode: ERROR_CODES.UNAUTHORIZED,
      message: 'Unauthorized',
    },
    {
      statusCode: 404,
      errorCode: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    },
  )
  me(@Req() request: Request & { user?: JwtPayload }) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.authService.me(request.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Current user profile updated',
    example: {
      id: 1,
      firstName: 'Ali',
      lastName: 'Mammadov',
      email: 'ali@example.com',
      phoneNumber: '+994501112233',
      birthDate: '2000-01-01T00:00:00.000Z',
      gender: 'male',
      roleId: 2,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T11:20:00.000Z',
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 400,
      errorCode: ERROR_CODES.EMPTY_UPDATE_PAYLOAD,
      message: 'At least one field must be provided for update',
    },
    {
      statusCode: 400,
      errorCode: ERROR_CODES.EMAIL_ALREADY_EXISTS,
      message: 'Email already exists',
    },
    {
      statusCode: 401,
      errorCode: ERROR_CODES.UNAUTHORIZED,
      message: 'Unauthorized',
    },
    {
      statusCode: 404,
      errorCode: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    },
  )
  updateMe(
    @Req() request: Request & { user?: JwtPayload },
    @Body() body: UpdateMeDto,
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.authService.updateMe(request.user.sub, body);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current user' })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Logged out successfully',
    example: {
      success: true,
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 401,
      errorCode: ERROR_CODES.UNAUTHORIZED,
      message: 'Unauthorized',
    },
  )
  logout(@Req() request: Request & { user?: JwtPayload }) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.authService.logout(request.user.sub, request.user.sessionId);
  }
}
