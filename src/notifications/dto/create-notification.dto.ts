import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ enum: ['info', 'success', 'warning', 'error'], example: 'info' })
  @IsString()
  @IsIn(['info', 'success', 'warning', 'error'])
  type: 'info' | 'success' | 'warning' | 'error';

  @ApiProperty({ example: 'Task yenilendi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Users modulunda yeni update var' })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message: string;

  @ApiProperty({ type: [Number], example: [2, 3, 7] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  userIds: number[];
}
