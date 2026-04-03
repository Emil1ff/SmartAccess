import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from './common/swagger/success-responses.decorator';
import { AppService } from './app.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'System ping endpoint' })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Returns basic API health text',
    example: 'Hello World!',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
