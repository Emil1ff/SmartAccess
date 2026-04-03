import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FindUsersQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    enum: [10, 25, 50, 75, 100],
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 25, 50, 75, 100])
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId?: number;

  @ApiPropertyOptional({
    // example: 'emil hesenov',
    description: 'Search by firstName, lastName, email or phoneNumber',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['id', 'firstName', 'lastName', 'email', 'birthDate', 'createdAt', 'updatedAt'],
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'firstName', 'lastName', 'email', 'birthDate', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'id'
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'birthDate'
    | 'createdAt'
    | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
