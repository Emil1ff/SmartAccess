import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ErrorCode } from './error-codes';

function toBody(message: string | string[], errorCode: ErrorCode) {
  return {
    message,
    errorCode,
  };
}

export function badRequest(
  message: string | string[],
  errorCode: ErrorCode,
): BadRequestException {
  return new BadRequestException(toBody(message, errorCode));
}

export function notFound(
  message: string | string[],
  errorCode: ErrorCode,
): NotFoundException {
  return new NotFoundException(toBody(message, errorCode));
}

export function forbidden(
  message: string | string[],
  errorCode: ErrorCode,
): ForbiddenException {
  return new ForbiddenException(toBody(message, errorCode));
}

export function unauthorized(
  message: string | string[],
  errorCode: ErrorCode,
): UnauthorizedException {
  return new UnauthorizedException(toBody(message, errorCode));
}
