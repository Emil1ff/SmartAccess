import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { unauthorized } from '../common/errors/app-exceptions';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ERROR_CODES } from '../common/errors/error-codes';
import { ApiErrorResponses } from '../common/swagger/error-responses.decorator';
import { ApiSuccessResponse } from '../common/swagger/success-responses.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { FindRolesQueryDto } from './dto/find-roles-query.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

type JwtPayload = {
  sub: number;
  roleId: number;
};

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions('roles:add')
  @ApiSuccessResponse({
    statusCode: 201,
    description: 'Role created',
    example: {
      id: 2,
      name: 'manager',
      isRoot: false,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    { statusCode: 400, errorCode: ERROR_CODES.ROLE_NAME_EXISTS, message: 'Role name already exists' },
  )
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @Permissions('roles:view', 'permissions:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Roles list',
    example: [
      {
        id: 1,
        name: 'root',
        isRoot: true,
      },
    ],
  })
  findAll(@Query() query: FindRolesQueryDto) {
    return this.rolesService.findAll(query);
  }

  @Get(':id')
  @Permissions('roles:view', 'permissions:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Single role',
    example: {
      id: 1,
      name: 'root',
      isRoot: true,
    },
  })
  @ApiErrorResponses(
    { statusCode: 404, errorCode: ERROR_CODES.ROLE_NOT_FOUND, message: 'Role not found' },
  )
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('roles:edit')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Role updated',
    example: {
      id: 2,
      name: 'senior-manager',
      isRoot: false,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T12:30:00.000Z',
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
      errorCode: ERROR_CODES.ROOT_ROLE_CANNOT_BE_DOWNGRADED,
      message: 'Root role cannot be downgraded',
    },
    { statusCode: 400, errorCode: ERROR_CODES.ROLE_NAME_EXISTS, message: 'Role name already exists' },
    { statusCode: 404, errorCode: ERROR_CODES.ROLE_NOT_FOUND, message: 'Role not found' },
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @Req() request: Request & { user?: JwtPayload },
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.rolesService.update(id, dto, request.user.roleId);
  }

  @Put(':id/permissions')
  @Permissions('roles:edit')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Role permissions replaced',
    example: {
      id: 2,
      name: 'manager',
      isRoot: false,
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 400,
      errorCode: ERROR_CODES.ROOT_ROLE_PERMISSIONS_IMPLICIT,
      message: 'Root role has all permissions implicitly and cannot be manually edited',
    },
    {
      statusCode: 404,
      errorCode: ERROR_CODES.PERMISSION_NOT_FOUND,
      message: 'One or more permissions not found',
    },
    { statusCode: 404, errorCode: ERROR_CODES.ROLE_NOT_FOUND, message: 'Role not found' },
  )
  setPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRolePermissionsDto,
    @Req() request: Request & { user?: JwtPayload },
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.rolesService.setPermissions(id, dto, request.user.roleId);
  }

  @Delete(':id')
  @Permissions('roles:delete')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Role deleted',
    example: {
      id: 2,
      name: 'manager',
      isRoot: false,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T12:30:00.000Z',
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 400,
      errorCode: ERROR_CODES.ROOT_ROLE_CANNOT_BE_DELETED,
      message: 'Root role cannot be deleted',
    },
    { statusCode: 404, errorCode: ERROR_CODES.ROLE_NOT_FOUND, message: 'Role not found' },
  )
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: JwtPayload },
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.rolesService.remove(id, request.user.roleId);
  }
}
