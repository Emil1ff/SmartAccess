import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import type { ErrorCode } from '../errors/error-codes';

type ErrorExample = {
  statusCode: number;
  errorCode: ErrorCode;
  message: string | string[];
  exampleName?: string;
};

function exampleToKey(example: ErrorExample): string {
  return example.exampleName ?? example.errorCode;
}

export function ApiErrorResponses(...examples: ErrorExample[]) {
  return applyDecorators(
    ...examples.map((example) =>
      ApiResponse({
        status: example.statusCode,
        description: Array.isArray(example.message)
          ? example.message.join(', ')
          : example.message,
        content: {
          'application/json': {
            examples: {
              [exampleToKey(example)]: {
                value: {
                  statusCode: example.statusCode,
                  message: example.message,
                  errorCode: example.errorCode,
                  timestamp: new Date().toISOString(),
                },
              },
            },
          },
        },
      }),
    ),
  );
}
