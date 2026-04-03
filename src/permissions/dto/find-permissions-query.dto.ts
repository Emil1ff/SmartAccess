import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindPermissionsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId?: number;

  @ApiPropertyOptional({ example: 'view' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'user' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['id', 'moduleId', 'action', 'createdAt', 'updatedAt'],
    example: 'moduleId',
  })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'moduleId', 'action', 'createdAt', 'updatedAt'])
  sortBy?: 'id' | 'moduleId' | 'action' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
