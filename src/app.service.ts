import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      success: true,
      message: 'School ERP API is running successfully.',
      timestamp: new Date().toISOString(),
    };
  }
}