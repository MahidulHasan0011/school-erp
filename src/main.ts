import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Logger.log(`Server is running on http://localhost:${port}`, 'Bootstrap');

  Logger.log(`School ERP API started successfully`, 'Bootstrap');
  Logger.log(`Environment : ${process.env.NODE_ENV || 'development'}`, 'Bootstrap');
  Logger.log(`Listening on : http://localhost:${port}`, 'Bootstrap');


}
bootstrap();
