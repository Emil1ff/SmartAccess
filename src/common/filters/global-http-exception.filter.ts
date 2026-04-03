import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  errorCode: string;
  timestamp: string;
};

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        exceptionResponse &&
        typeof exceptionResponse === 'object'
      ) {
        const responseObject = exceptionResponse as Record<string, unknown>;

        if (typeof responseObject.message === 'string') {
          message = responseObject.message;
        } else if (Array.isArray(responseObject.message)) {
          message = responseObject.message.filter(
            (item): item is string => typeof item === 'string',
          );
        }

        if (typeof responseObject.errorCode === 'string') {
          errorCode = this.toErrorCode(responseObject.errorCode);
        } else if (typeof responseObject.error === 'string') {
          errorCode = this.toErrorCode(responseObject.error);
        } else {
          errorCode = this.toErrorCode(HttpStatus[statusCode] ?? 'HTTP_EXCEPTION');
        }
      }
    }

    const payload: ErrorResponseBody = {
      statusCode,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(payload);
  }

  private toErrorCode(input: string): string {
    return input.trim().replace(/\s+/g, '_').toUpperCase();
  }
}
