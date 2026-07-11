Phase 1 — Project Create
   npm i -g @nestjs/cli
   nest new school-erp

Install Packages
  npm install pg

  Validation

  npm install class-validator class-transformer

  JWT

  npm install @nestjs/jwt passport passport-jwt @nestjs/passport

  Hash

  npm install bcrypt

  Redis

  npm install ioredis

  Queue

  npm install @nestjs/bullmq bullmq

  Upload

  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

  Config

  npm install @nestjs/config

  Swagger

  npm install @nestjs/swagger swagger-ui-express 



  main.ts: এটি প্রজেক্টের এন্ট্রি পয়েন্ট। এর কাজ হলো অ্যাপ্লিকেশনটি স্টার্ট বা রান করা।
  app.module.ts: এটি অ্যাপ্লিকেশনের রুট মডিউল (Root Module)। এটি পুরো প্রজেক্টের সব মডিউল ও সার্ভিসকে একসাথে যুক্ত করে।



  Decorator হলো NestJS-এর জন্য একটি "লেবেল" বা "ব্যাজ"। এটি NestJS-কে বলে দেয়—"এই Class, Method বা Parameter-এর কাজ কী।"

  সবচেয়ে গুরুত্বপূর্ণ Decoratorগুলো
   Decorator	কাজ
   @Controller()	এই Class একটি Controller
   @Injectable()	এই Class-কে DI Container-এ Register করো
   @Module()	Module তৈরি করে
   @Get()	GET Request Handle করে
   @Post()	POST Request Handle করে
   @Put()	PUT Request Handle করে
   @Patch()	PATCH Request Handle করে
   @Delete()	DELETE Request Handle করে
   @Body()	Request Body নিয়ে আসে
   @Param()	URL Parameter নিয়ে আসে
   @Query()	Query Parameter নিয়ে আসে
   @Headers()	Request Header নিয়ে আসে
   @Req()	পুরো Request Object দেয়
   @Res()	পুরো Response Object দেয়
   @UseGuards()	Route-এ Guard লাগায় (যেমন Login Check)
   @UseInterceptors()	Request/Response-এর আগে বা পরে অতিরিক্ত কাজ করে
   @UsePipes()	Validation বা Data Transform করে




  DTO = Data Transfer Object 
  DTO হলো একটা ফর্ম (Form), যেখানে লেখা থাকে কোন কোন তথ্য নেওয়া যাবে।
  DTO হলো এমন একটি "নিয়মযুক্ত ফর্ম" যা বলে দেয়, Client থেকে কী ধরনের ডাটা গ্রহণ করা হবে এবং সেই ডাটা সঠিক কি না।
  Validation (@IsString(), @IsInt()) = ফর্ম ঠিকভাবে পূরণ হয়েছে কি না তা যাচাই করা