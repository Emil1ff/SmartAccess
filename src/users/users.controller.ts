import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { unauthorized } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { ApiErrorResponses } from '../common/swagger/error-responses.decorator';
import { ApiSuccessResponse } from '../common/swagger/success-responses.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type JwtPayload = {
  sub: number;
  roleId: number;
};

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users:add')
  @ApiSuccessResponse({
    statusCode: 201,
    description: 'User created',
    example: {
      id: 2,
      firstName: 'Ali',
      lastName: 'Mammadov',
      email: 'ali@example.com',
      phoneNumber: '+994501112233',
      birthDate: '2000-01-01T00:00:00.000Z',
      gender: 'male',
      roleId: 2,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
      role: {
        id: 2,
        name: 'manager',
        isRoot: false,
      },
    },
  })
  @ApiErrorResponses(
    { statusCode: 400, errorCode: ERROR_CODES.EMAIL_ALREADY_EXISTS, message: 'Email already exists' },
    {
      statusCode: 400,
      errorCode: ERROR_CODES.SELECTED_ROLE_NOT_FOUND,
      message: 'Selected role does not exist',
    },
  )
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Permissions('users:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Users list',
    example: {
      data: [
        {
          id: 1,
          firstName: 'root',
          lastName: 'root',
          email: 'root@smarthub.az',
          phoneNumber: null,
          birthDate: '2006-08-31T00:00:00.000Z',
          gender: 'other',
          roleId: 1,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    },
  })
  findAll(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Permissions('users:view')
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Single user',
    example: {
      id: 1,
      firstName: 'root',
      lastName: 'root',
      email: 'root@smarthub.az',
      phoneNumber: null,
      birthDate: '2006-08-31T00:00:00.000Z',
      gender: 'other',
      roleId: 1,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Permissions('users:edit')
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'User updated',
    example: {
      id: 2,
      firstName: 'Ali',
      lastName: 'Mammadov',
      email: 'ali@example.com',
      phoneNumber: '+994501112233',
      birthDate: '2000-01-01T00:00:00.000Z',
      gender: 'male',
      roleId: 2,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T12:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 400,
      errorCode: ERROR_CODES.EMPTY_UPDATE_PAYLOAD,
      message: 'At least one field must be provided for update',
    },
    { statusCode: 400, errorCode: ERROR_CODES.EMAIL_ALREADY_EXISTS, message: 'Email already exists' },
    {
      statusCode: 400,
      errorCode: ERROR_CODES.SELECTED_ROLE_NOT_FOUND,
      message: 'Selected role does not exist',
    },
    { statusCode: 404, errorCode: ERROR_CODES.USER_NOT_FOUND, message: 'User not found' },
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() request: Request & { user?: JwtPayload },
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.usersService.update(id, updateUserDto, request.user.sub);
  }

  @Delete(':id')
  @Permissions('users:delete')
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'User deleted',
    example: {
      id: 2,
      firstName: 'Ali',
      lastName: 'Mammadov',
      email: 'ali@example.com',
      phoneNumber: '+994501112233',
      birthDate: '2000-01-01T00:00:00.000Z',
      gender: 'male',
      roleId: 2,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T12:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    { statusCode: 400, errorCode: ERROR_CODES.SYSTEM_ROOT_USER_DELETE_FORBIDDEN, message: 'System root user cannot be deleted' },
    { statusCode: 404, errorCode: ERROR_CODES.USER_NOT_FOUND, message: 'User not found' },
  )
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
