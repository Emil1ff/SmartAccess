import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

type SuccessResponseConfig = {
  statusCode: number;
  description: string;
  example: unknown;
};

export function ApiSuccessResponse(config: SuccessResponseConfig) {
  return applyDecorators(
    ApiResponse({
      status: config.statusCode,
      description: config.description,
      content: {
        'application/json': {
          example: config.example,
        },
      },
    }),
  );
}
