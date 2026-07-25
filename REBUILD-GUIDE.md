# 🏗️ School ERP — Scratch থেকে Rebuild Guide

> এই গাইডটা আজকের আলোচনার ভিত্তিতে বানানো। উদ্দেশ্য: পুরো project scratch থেকে
> নিজ হাতে বানিয়ে প্রতিটা layer কেন আছে সেটা বোঝা। **উপর থেকে নিচে ঠিক এই ক্রমে**
> এগোবে — প্রতিটা ধাপ আগেরটার উপর দাঁড়ায়।
>
> **Stack:** NestJS 11 · TypeORM 0.3.30 · PostgreSQL (Supabase) · Redis · RabbitMQ · MinIO/S3 · Socket.IO
> **Golden rule:** `synchronize: false` (database-first) — schema সবসময় migration/SQL দিয়ে বদলাবে, TypeORM দিয়ে নয়।

---

## 🧭 প্রতিটা module বানানোর standard ক্রম

প্রতিবার এই ৭ ধাপ — মুখস্থ করে ফেলো:

```
entity → dto → repository → service → controller → module → app.module-এ register
```

প্রতিটা module শেষে Postman/Thunder দিয়ে route টেস্ট করো, তারপরই পরেরটায় যাও।

---

## 📦 ধাপ ০ — Foundation (কোড লেখার আগে)

- [ ] Database schema আগে ডিজাইন করো (dbdiagram.io / কাগজ) — ER diagram
      - users, roles, permissions, role_permissions
      - students, teachers, classes, sections, subjects, academic_sessions, student_enrollments
      - exams, attendance, exam_results, ranking_history, ranking_locks
      - error_logs, uploads, notifications, leaves
- [ ] `nest new school-erp` — খালি project
- [ ] Folder structure: `src/common`, `src/config`, `src/modules`, `src/database`
- [ ] `config/*.ts` বানাও: `app.config`, `database.config`, `jwt.config`, `redis.config`, `rabbitmq.config`, `storage.config`
- [ ] `.env` + `.env.example` (দুটোই maintain করবে)
- [ ] `app.module.ts`-এ `ConfigModule.forRoot({ isGlobal: true, load: [...] })`
- [ ] `TypeOrmModule.forRootAsync` → `autoLoadEntities: true`, `synchronize: false`, Supabase SSL
- [ ] `main.ts` — global `ValidationPipe`, CORS, port

✅ **এই ধাপ শেষে:** server চালু হয়, DB-তে connect হয়, কিন্তু কোনো route নেই।

---

## 🔧 ধাপ ১ — Common / Shared layer (আসল ভিত্তি)

> এগুলো ছাড়া প্রতিটা module-এ কোড repeat হবে। **সবার আগে এটা শক্ত করো।**

- [ ] `common/dto/pagination.dto.ts` — `page`, `limit`, `search`, `sortBy`, `order`, `skip` getter
- [ ] `common/utils/pagination.util.ts` — `paginate()`, `getPagination()`
- [ ] `common/utils/query-builder.util.ts` — `applySearch()`, `applyFilters()`, `applyPagination()`
- [ ] `common/utils/order.util.ts` — `safeSortColumn()`, `normalizeOrder()`
- [ ] Global `HttpExceptionFilter` (error → standard shape)
- [ ] Global `ResponseInterceptor` (success → standard shape)
- [ ] `common/redis/redis.module.ts` (@Global) + `redis.service.ts` (ioredis)

✅ **এই ধাপ শেষে:** যেকোনো module-এ pagination/search/filter ২ লাইনে পাওয়া যায়।

---

## 🔐 ধাপ ২ — Auth + RBAC (সব route-এর দারোয়ান)

- [ ] **Users module** (entity + basic CRUD আগে)
- [ ] **Auth module**
      - [ ] login → password যাচাই → JWT issue (payload: `{ sub, email, roles?, permissions?, sid }`)
      - [ ] `session:<sid>` Redis-এ রাখা (logout = key মুছে ফেলা)
      - [ ] `JwtStrategy` (secret = `jwt.secret`) + session বেঁচে আছে কিনা check
      - [ ] `session.util.ts` — `sessionKey(sid)`
- [ ] **RBAC building blocks**
      - [ ] `JwtAuthGuard`
      - [ ] `PermissionsGuard` (user-এর permission list চেক)
      - [ ] `@Permissions('X')` decorator
      - [ ] `@CurrentUser('id')` decorator
- [ ] **Roles / Permissions / RolePermissions** module
      - [ ] Roles: `001` SUPER_ADMIN, `002` ADMIN, `003` TEACHER, `004` STUDENT, `005` ACCOUNTANT, `006` STAFF

✅ **এই ধাপ শেষে:** login → token → protected route কাজ করে। পরের সব module এই pattern copy করবে।

---

## 🏫 ধাপ ৩ — Core domain (একটা module পুরো শিখে ফেলো)

> প্রথমে শুধু **Students** module সম্পূর্ণ বানাও — এটাই তোমার "golden template"।

নির্ভরতার ক্রমে বানাও:

- [ ] AcademicSessions
- [ ] Classes
- [ ] Sections
- [ ] Subjects
- [ ] Teachers
- [ ] **Students** ⭐ (এটা পুরো মন দিয়ে, template হিসেবে)
- [ ] StudentEnrollments
- [ ] SubjectAssignments

💡 **প্রতিটা DTO-তে নিজেকে প্রশ্ন করো:** কোন field server নিজে সেট করবে
(`user_id`, `status`, timestamps, audit fields) আর কোনটা client দেবে?
→ **Server-set field গুলো create DTO-তে রাখবে না।** এটাই সবচেয়ে গুরুত্বপূর্ণ শিক্ষা।

---

## 🧮 ধাপ ৪ — Business logic (গভীর অংশ)

> এখানে raw CRUD-এর বাইরে আসল domain logic।

- [ ] Exams
- [ ] Attendance
- [ ] ExamResults
- [ ] **RabbitMQ module** (এখন লাগবে) — raw amqplib, delay queue + DLX দিয়ে backoff
      - [ ] Exponential backoff + **Equal Jitter (AWS)** + cap (`maxDelayMs`)
- [ ] RankingLocks (advisory-lock-ভিত্তিক lock/unlock)
- [ ] **Ranking module** ⚠️ (সবার শেষে — সবচেয়ে জটিল)
      - [ ] merit calculation + roll assignment
      - [ ] `pg_advisory_xact_lock` (raw — ORM API নেই, justified exception)
      - [ ] DB view `student_merit_list` পড়া (raw, justified)
      - [ ] background job RabbitMQ দিয়ে, status Redis-এ
      - [ ] `admissionTestEnabled` handling: `true` → merit; `false` → old student merit + new student FIFO

💡 Ranking সবশেষে ধরার কারণ: এতে advisory lock + RabbitMQ + Redis + view — সব একসাথে লাগে।

---

## 🧩 ধাপ ৫ — Support / Cross-cutting (আজকের শেষ করা অংশ)

- [ ] **ErrorLogs** — `error_logs` table, paginated read, clear/delete
      - [ ] `isOperational` filter: `undefined` হলে filter apply করবে না (`value === undefined ? undefined : ...`)
- [ ] **Uploads** (S3/MinIO)
      - [ ] `StorageService` — `getUploadUrl` / `getDownloadUrl` / `deleteObject` / `headObject`
      - [ ] presigned URL flow: `generate-url` → client uploads → `confirm` (headObject দিয়ে verify + fileSize reconcile)
      - [ ] `uploads` + `upload_audit_logs` table
- [ ] **Notifications** (per-recipient row)
      - [ ] `createMany`, `findMine`, `unreadCount`, `markRead`, `markAllRead`
      - [ ] `NotifyInput` helper — অন্য module (leave) থেকে ডাকা যায়
- [ ] **Leave** (self-apply + admin approve/reject)
      - [ ] `LeaveType` / `LeaveStatus` enum, owner-check (Forbidden if not owner)
      - [ ] approve/reject → `NotificationsService.notify()` দিয়ে owner-কে জানানো
- [ ] **Dashboard** — `@InjectDataSource`, `Promise.all` দিয়ে counts + pending + recent
- [ ] **WebSocket** (real-time push)
      - [ ] `EventsGateway` — namespace `/events`, JWT socket auth (secret + Redis session check)
      - [ ] per-user room `user:<id>` → `emitToUser(userId, event, payload)`
      - [ ] `NotificationsService`-এ inject → save-এর পর live push
      - [ ] Client: `io('http://host/events', { auth: { token } })`

---

## ⚙️ Infrastructure (docker দিয়ে local dev)

- [ ] `docker-compose.yml` — redis (6379), rabbitmq (5672/15672), minio (9000/9001)
- [ ] npm scripts: `infra:up`, `infra:down`, `infra:reset`, `infra:ps`, `infra:logs`
- [ ] Migrations: `src/database/migrations/*` + `migration:run`
- [ ] Seed: `src/database/seeds/seed.sql` (roles, permissions, grants) — migration-এর সাথে mirror রাখো

---

## 🎯 সারসংক্ষেপ — কোথা থেকে শুরু

| ক্রম | কী বানাবে | কেন |
|------|-----------|-----|
| 1 | ধাপ ০ (foundation) | server + DB connect |
| 2 | ধাপ ১ (common) | repeat কোড বন্ধ |
| 3 | ধাপ ২ (auth + RBAC) | সব route-এর দারোয়ান |
| 4 | **Students module একা** | golden template |
| 5 | বাকি core domain | template copy |
| 6 | business logic (ranking শেষে) | সব concept একসাথে |
| 7 | support modules | cross-cutting |

**শেখার নিয়ম:** পুরনো কোড copy না করে খালি ফাইলে নিজে টাইপ করো; আটকে গেলে তবেই দেখো।
প্রতিটা module শেষে route টেস্ট করে তবেই এগোও।

---

*Generated from the project's current architecture — আজকের আলোচনার ভিত্তিতে।*
