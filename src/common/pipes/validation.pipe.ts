import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * Project-wide default validation options. Registered globally in main.ts,
 * but exported here so individual routes can override when needed.
 */
export const defaultValidationOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
};

export class AppValidationPipe extends ValidationPipe {
  constructor(options: ValidationPipeOptions = {}) {
    super({ ...defaultValidationOptions, ...options });
  }
}
