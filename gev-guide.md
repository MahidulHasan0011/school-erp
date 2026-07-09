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