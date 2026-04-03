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
import { CreateModuleDto } from './dto/create-module.dto';
import { FindModulesQueryDto } from './dto/find-modules-query.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModulesService } from './modules.service';

@ApiTags('Modules')
@ApiBearerAuth()
@Controller('modules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post()
  @Permissions('modules:add')
  @ApiSuccessResponse({
    statusCode: 201,
    description: 'Module created',
    example: {
      id: 1,
      name: 'users',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    { statusCode: 400, errorCode: ERROR_CODES.MODULE_NAME_EXISTS, message: 'Module name already exists' },
  )
  create(@Body() dto: CreateModuleDto) {
    return this.modulesService.create(dto);
  }

  @Get()
  @Permissions('modules:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Modules list',
    example: [
      {
        id: 1,
        name: 'users',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      },
    ],
  })
  findAll(@Query() query: FindModulesQueryDto) {
    return this.modulesService.findAll(query);
  }

  @Get(':id')
  @Permissions('modules:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Single module',
    example: {
      id: 1,
      name: 'users',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    { statusCode: 404, errorCode: ERROR_CODES.MODULE_NOT_FOUND, message: 'Module not found' },
  )
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.modulesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('modules:edit')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Module updated',
    example: {
      id: 1,
      name: 'users-management',
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
    { statusCode: 400, errorCode: ERROR_CODES.MODULE_NAME_EXISTS, message: 'Module name already exists' },
    { statusCode: 404, errorCode: ERROR_CODES.MODULE_NOT_FOUND, message: 'Module not found' },
  )
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateModuleDto) {
    return this.modulesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('modules:delete')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Module deleted with related permissions and role assignments',
    example: {
      id: 1,
      name: 'users',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T12:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    { statusCode: 404, errorCode: ERROR_CODES.MODULE_NOT_FOUND, message: 'Module not found' },
  )
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.modulesService.remove(id);
  }
}
