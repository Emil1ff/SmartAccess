import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsDate,
	IsEmail,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	MinLength,
} from 'class-validator';

export class CreateUserDto {
	@ApiProperty({ example: 'Ali' })
	@IsString()
	firstName: string;

	@ApiProperty({ example: 'Mammadov' })
	@IsString()
	lastName: string;

	@ApiProperty({ example: 'ali@example.com' })
	@IsEmail()
	email: string;

	@ApiPropertyOptional({ example: '+994501112233' })
	@IsOptional()
	@IsString()
	phoneNumber?: string;

	@ApiPropertyOptional({
		example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
		description: 'Base64-encoded profile image',
	})
	@IsOptional()
	@IsString()
	profileImage?: string;

	@ApiProperty({ example: '12345678' })
	@IsString()
	@MinLength(6)
	password: string;

	@ApiProperty({ example: '2000-01-01T00:00:00.000Z', format: 'date-time' })
	@Type(() => Date)
	@IsDate()
	birthDate: Date;

	@ApiProperty({ enum: ['male', 'female', 'other'], example: 'male' })
	@IsIn(['male', 'female', 'other'])
	gender: string;

	@ApiPropertyOptional({ example: 2 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	roleId?: number;
}
