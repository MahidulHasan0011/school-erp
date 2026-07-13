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




  npm run migration:run	schema + view তৈরি (000-009)
npm run seed	data ঢালা
npm run db:reset	migration:run + seed (fresh DB প্রথমবার)
npm run db:truncate	সব data মুছে ফেলা
npm run db:refresh	truncate + seed (data রিসেট, schema অক্ষত)
npm run migration:revert	শেষ migration undo




প্রথমে Interceptor কী?

ধরো তুমি একটা স্কুলে ঢুকছো।

স্কুলের গেটে একজন গার্ড আছে।

তুমি ঢোকার আগে সে দেখে

কে আসছে
কখন আসছে
কেন আসছে

আবার বের হওয়ার সময় দেখে

কতক্ষণ ছিলে
কী নিয়ে বের হলে

Interceptor ঠিক এই গার্ডের মতো।

এটা Request Controller-এ যাওয়ার আগে এবং Response Client-এর কাছে যাওয়ার আগে কাজ করতে পারে।

NestJS Request Flow
Client
   │
   ▼
Middleware
   │
   ▼
Guard
   │
   ▼
Interceptor (Before)
   │
   ▼
Pipe
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
Interceptor (After)
   │
   ▼
Client

দেখো,

Interceptor দুই জায়গায় কাজ করতে পারে।

Before Controller

After Controller

এটাই সবচেয়ে বড় শক্তি।


আর কী কী করা যায়?

Interceptor শুধু Logging-এর জন্য না।

অনেক কাজ করা যায়।

১. Response পরিবর্তন

Controller

return students;

Interceptor

return next.handle().pipe(
    map(data=>({
        success:true,
        data
    }))
)

Client পাবে

{
    "success": true,
    "data": [
        ...
    ]
}

Controller কিছুই জানে না।

২. Response Time বের করা

তোমার LoggingInterceptor এটিই করছে।

৩. Cache
আগে Response আছে?

হ্যাঁ

↓

Controller-এ যেও না

↓

Cache থেকে Return করো
৪. File Compression

Response ছোট করে পাঠানো।

৫. Data Masking

Database

{
"id":1,
"name":"Mahid",
"password":"123456"
}

Interceptor

delete data.password;

Client

{
"id":1,
"name":"Mahid"
}

৬. Response Format

Controller

return user;

Interceptor

return {
success:true,
message:"Success",
data:user
}

সব API একই Format।

তাহলে Middleware আর Interceptor-এর পার্থক্য কী?
| Middleware                             | Interceptor                       |
| -------------------------------------- | --------------------------------- |
| Controller-এর আগে চলে                  | Controller-এর আগে **এবং পরে** চলে |
| Response modify করতে পারে না (সহজভাবে) | Response modify করতে পারে         |
| Execution time মাপা কঠিন               | Execution time মাপা সহজ           |
| Express-এর middleware-এর মতো           | NestJS-এর advanced feature        |


Request Flow Example


Client

↓

Middleware

↓

Guard

↓

LoggingInterceptor (Start Time)

↓

Controller

↓

Service

↓

Database

↓

Controller Return

↓

LoggingInterceptor

↓

Console

GET /students - 35ms

↓

Client



সহজে মনে রাখার কৌশল
Middleware = দরজার প্রহরী (ভিতরে ঢোকার আগে দেখে)
Guard = অনুমতি আছে কি না দেখে
Pipe = ডেটা ঠিক আছে কি না যাচাই করে
Interceptor = ক্যামেরাম্যান 📹 — Request শুরু হওয়ার সময়ও দেখে, Response শেষ হওয়ার সময়ও দেখে; চাইলে Response পরিবর্তনও করতে পারে।
Exception Filter = Error হলে সেটি সুন্দরভাবে Handle করে