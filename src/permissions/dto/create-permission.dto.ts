import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  moduleId: number;

  @ApiProperty({ enum: ['view', 'add', 'edit', 'delete'], example: 'view' })
  @IsIn(['view', 'add', 'edit', 'delete'])
  action: string;
}
