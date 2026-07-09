import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { setupSwagger } from './docs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // সব রুট /api দিয়ে শুরু হবে (যেমন: http://localhost:3000/api/users)
  app.setGlobalPrefix('api');

  // গ্লোবাল ভ্যালিডেশন — DTO তে class-validator এর নিয়ম অটো চেক হবে
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // গ্লোবাল এরর ফরম্যাট + রেসপন্স র‍্যাপার + রিকোয়েস্ট লগিং
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  // Swagger API ডকুমেন্টেশন → http://localhost:3000/docs
  setupSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(`School ERP API started successfully`, 'Bootstrap');
  Logger.log(
    `Environment  : ${process.env.NODE_ENV || 'development'}`,
    'Bootstrap',
  );
  Logger.log(`Listening on : http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Swagger docs : http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
