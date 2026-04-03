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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ERROR_CODES } from '../common/errors/error-codes';
import { ApiErrorResponses } from '../common/swagger/error-responses.decorator';
import { ApiSuccessResponse } from '../common/swagger/success-responses.decorator';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { FindPermissionsQueryDto } from './dto/find-permissions-query.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions('permissions:add')
  @ApiSuccessResponse({
    statusCode: 201,
    description: 'Permission created or updated',
    example: {
      id: 1,
      moduleId: 1,
      action: 'view',
      module: {
        id: 1,
        name: 'users',
      },
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    {
      statusCode: 400,
      errorCode: ERROR_CODES.PERMISSION_ALREADY_EXISTS,
      message: 'Permission already exists for this module',
    },
    { statusCode: 404, errorCode: ERROR_CODES.MODULE_NOT_FOUND, message: 'Module not found' },
  )
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Get()
  @Permissions('permissions:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Permissions list',
    example: [
      {
        id: 1,
        moduleId: 1,
        action: 'view',
      },
    ],
  })
  findAll(@Query() query: FindPermissionsQueryDto) {
    return this.permissionsService.findAll(query);
  }

  @Get(':id')
  @Permissions('permissions:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Single permission',
    example: {
      id: 1,
      moduleId: 1,
      action: 'view',
      module: {
        id: 1,
        name: 'users',
      },
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    { statusCode: 404, errorCode: ERROR_CODES.PERMISSION_NOT_FOUND, message: 'Permission not found' },
  )
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('permissions:edit')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Permission updated',
    example: {
      id: 1,
      moduleId: 1,
      action: 'edit',
      module: {
        id: 1,
        name: 'users',
      },
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
    {
      statusCode: 400,
      errorCode: ERROR_CODES.PERMISSION_ALREADY_EXISTS,
      message: 'Permission already exists for this module',
    },
    { statusCode: 404, errorCode: ERROR_CODES.PERMISSION_NOT_FOUND, message: 'Permission not found' },
    { statusCode: 404, errorCode: ERROR_CODES.MODULE_NOT_FOUND, message: 'Module not found' },
  )
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('permissions:delete')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Permission deleted',
    example: {
      id: 1,
      moduleId: 1,
      action: 'view',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T12:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    { statusCode: 404, errorCode: ERROR_CODES.PERMISSION_NOT_FOUND, message: 'Permission not found' },
  )
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.remove(id);
  }
}
