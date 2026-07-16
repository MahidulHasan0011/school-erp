# Ranking Module — কীভাবে কাজ করে (নতুনদের জন্য)

> এই module-এর কাজ: একটা class + academic session-এর সব student-কে
> পরীক্ষার ফলাফল অনুযায়ী **merit অনুসারে সাজানো (ranking)** এবং তারপর
> প্রত্যেককে **roll number + section** বসিয়ে দেওয়া।
>
> ভারী কাজটা সাথে সাথে না করে **background job**-এ (RabbitMQ queue) করা হয়,
> যাতে API সাথে সাথে response দিতে পারে আর কাজ fail করলে নিজে থেকে retry হয়।

---

## ১. এক নজরে পুরো গল্প

ভাবুন একটা স্কুলে বছর শেষে সব ছাত্রের নতুন roll ঠিক করতে হবে:

1. **Admin** button চাপে → "এই class-এর roll generate করো"।
2. Server সাথে সাথে বলে: **"ঠিক আছে, কাজ শুরু হলো (queued)"** — বসে থাকে না।
3. পেছনে (background-এ) দুই ধাপে কাজ হয়:
   - **ধাপ ১ (Ranking):** সব ছাত্রকে নম্বর অনুযায়ী ১, ২, ৩... করে সাজানো।
   - **ধাপ ২ (Roll):** সেই তালিকা থেকে প্রত্যেককে roll ও section বসানো, ইতিহাস
     (history) সংরক্ষণ, এবং class-টা **lock** করে দেওয়া (যাতে ভুল করে আবার না চলে)।
4. Admin পরে GET request দিয়ে দেখে কাজ শেষ হয়েছে কিনা এবং ফলাফল কী।

---

## ২. ফোল্ডার structure — কোন জিনিস কোথায়

```
ranking/
│
├── ranking.controller.ts     ← HTTP endpoint (বাইরের দুনিয়ার দরজা)
├── ranking.service.ts        ← "ম্যানেজার": যাচাই করে, queue-তে পাঠায়, status রাখে
├── ranking.repository.ts     ← raw SQL (database-এর সাথে সরাসরি কথা)
├── ranking.constants.ts      ← queue-এর নাম + job payload-এর গঠন (type)
│
├── engine/                   ← 🧠 আসল হিসাব-নিকাশ (business logic)
│   ├── ranking.engine.ts     ← ছাত্রদের merit অনুযায়ী সাজায় (rankedList বানায়)
│   └── roll.engine.ts        ← roll + section বসায়, history + lock + audit (transaction)
│
├── queue/                    ← 📤 চিঠি পাঠানোর অফিস (producer — job পাঠায়)
│   ├── ranking.queue.ts      ← STEP 1 job পাঠায়
│   └── roll.queue.ts         ← STEP 2 job পাঠায়
│
├── job/                      ← 📥 চিঠি গ্রহণ করার অফিস (worker — job করে)
│   ├── ranking.job.ts        ← STEP 1 job শোনে ও চালায়
│   └── roll.job.ts           ← STEP 2 job শোনে ও চালায়
│
└── entities/                 ← database table-এর TypeORM ছবি
    ├── ranking-history.entity.ts    ← প্রতিটা version-এর snapshot
    └── ranking-audit-log.entity.ts  ← কে কখন কী করলো তার লগ
```

**সহজ কথায় মনে রাখার নিয়ম:**

| ফোল্ডার | ভূমিকা | উপমা |
|---------|--------|------|
| `queue/` | job **পাঠায়** | চিঠি পোস্ট করা |
| `job/`   | job **শোনে ও চালায়** | ডাকপিয়ন চিঠি এনে দেয় |
| `engine/`| আসল **হিসাব করে** | হিসাবরক্ষক |
| `service`| সব **সমন্বয় করে** | ম্যানেজার |

---

## ৩. পুরো flow — ছবি সহ

```
   Admin
     │  POST /ranking/generate-roll  { classId, academicSessionId }
     ▼
┌─────────────────────┐
│ ranking.controller  │  request গ্রহণ করে, @HttpCode(202)
└─────────┬───────────┘
          ▼
┌─────────────────────────────────────────────┐
│ ranking.service → requestGenerate()          │
│  ✔ class ও session আছে কিনা                  │
│  ✔ locked কিনা (locked হলে 409)              │
│  ✔ FINAL exam PUBLISHED কিনা                 │
│  → enqueue(): status='queued' + queue-তে পাঠায়│
└─────────┬───────────────────────────────────┘
          ▼
   ranking.queue.publish()
          │
          ▼   [ RabbitMQ: "ranking.jobs" queue ]
          │
          ▼
┌─────────────────────────────────────────────┐   ← STEP 1 (background)
│ ranking.job (worker)                         │
│  → service.processRankingJob()               │
│      status = 'processing' (stage: ranking)  │
│      RankingEngine.buildCombinedRanking()    │
│        = ছাত্রদের merit অনুযায়ী সাজানো তালিকা │
│      → roll.queue.publish({..., rankedList}) │
└─────────┬───────────────────────────────────┘
          ▼
   roll.queue.publish()
          │
          ▼   [ RabbitMQ: "roll.jobs" queue ]
          │
          ▼
┌─────────────────────────────────────────────┐   ← STEP 2 (background)
│ roll.job (worker)                            │
│  → service.processRollJob()                  │
│      status = 'processing' (stage: roll)     │
│      RollEngine.generateRolls()  [1 transaction]:│
│        • advisory lock (concurrency guard)   │
│        • roll + section assign               │
│        • ranking_history save (নতুন version) │
│        • class LOCK করা                       │
│        • audit log লেখা                       │
│      status = 'completed' ✅                  │
└─────────────────────────────────────────────┘

   Admin
     │  GET /ranking/:classId/:sessionId
     ▼
   service.getRanking() → jobStatus + সাজানো তালিকা ফেরত
```

---

## ৩ক. Exact function call chain (ঠিক কোন function কোনটাকে ডাকে)

নিচে প্রতিটা `→` মানে "এই function ওই function-কে ডাকে"। ফাইলের নাম বন্ধনীতে।

### 🟦 GENERATE — `POST /ranking/generate-roll`

**পর্ব A — request (synchronous, HTTP thread-এ):**

```
RankingController.generateRoll(dto, userId)          [ranking.controller.ts]
  └─→ RankingService.requestGenerate(dto, triggeredBy)   [ranking.service.ts]
        ├─→ this.loadClassAndSession(classId, sessionId)
        │     ├─→ ClassesRepository.findById(classId)        // না পেলে 404
        │     └─→ AcademicSessionsRepository.findById(id)     // না পেলে 404
        │         └─ return session.admissionTestEnabled
        ├─→ RankingLocksService.isLocked(classId, sessionId) // true হলে 409
        ├─→ this.assertExamsReady(classId, sessionId, admissionEnabled)
        │     ├─→ RankingRepository.isExamPublished(…, 'FINAL')      // false হলে 400
        │     └─→ RankingRepository.isExamPublished(…, 'ADMISSION')  // admission হলে
        └─→ this.enqueue('GENERATE', dto, triggeredBy)
              ├─→ this.setJobStatus(…, 'queued', {action})
              │     └─→ RedisService.setEx(key, value, 86400)
              └─→ RankingQueue.publish(payload)              [queue/ranking.queue.ts]
                    └─→ RabbitMQService.publish('ranking.jobs', payload)
        ⏎ return { status:'queued', … }   →  HTTP 202 Accepted
```

**পর্ব B — STEP 1 worker (background, RabbitMQ thread-এ):**

```
RankingJob.onModuleInit() একবার consumer register করে রাখে   [job/ranking.job.ts]
  └─ RabbitMQService "ranking.jobs" থেকে message পেলে ডাকে ↓

RankingService.processRankingJob(payload)              [ranking.service.ts]
  ├─→ this.setJobStatus(…, 'processing', {stage:'ranking'})
  ├─→ this.loadClassAndSession(classId, sessionId)     // আবার যাচাই
  ├─→ RankingLocksService.isLocked(…)                  // GENERATE হলে re-check → locked হলে skip
  ├─→ RankingEngine.buildCombinedRanking(classId, sessionId, admissionEnabled)  [engine/ranking.engine.ts]
  │     ├─→ RankingRepository.getMeritList(…)           // OLD student merit (view)
  │     ├─→ RankingRepository.getNewStudents(…)         // NEW student (FIFO)
  │     ├─→ RankingRepository.getAdmissionScores(…)     // শুধু Scenario 2
  │     └─→ this.sortAndRank(list)                      // tie-break sort → rankPosition বসায়
  │         ⏎ return RankedEntry[]  (সাজানো তালিকা)
  └─→ RollQueue.publish({ ...payload, rankedList })     [queue/roll.queue.ts]
        └─→ RabbitMQService.publish('roll.jobs', payload)
  ⚠ কোথাও throw করলে → setJobStatus('failed') → RabbitMQ backoff retry
```

**পর্ব C — STEP 2 worker (background):**

```
RollJob.onModuleInit() একবার consumer register করে রাখে    [job/roll.job.ts]
  └─ RabbitMQService "roll.jobs" থেকে message পেলে ডাকে ↓

RankingService.processRollJob(payload)                 [ranking.service.ts]
  ├─→ this.setJobStatus(…, 'processing', {stage:'roll'})
  └─→ RollEngine.generateRolls(input, rankedList, triggeredBy, action)   [engine/roll.engine.ts]
        ├─→ RankingRepository.getSectionsForClass(classId)   // fixed section না হলে
        └─→ DataSource.transaction( async manager => {       // ⭐ সব এক transaction
              ├─→ RankingRepository.advisoryLock(manager, …)     // pg_advisory_xact_lock
              ├─→ this.assignRolls(rankedList, sections, fixedSectionId)  // roll+section হিসাব (pure)
              ├─→ RankingRepository.getNextVersion(manager, …)   // নতুন version নম্বর
              ├─ প্রতি student-এ loop:
              │    ├─→ RankingRepository.assignRollAndSection(manager, …)  // enrollment update
              │    └─→ RankingRepository.saveHistoryRow(manager, …)        // snapshot row
              ├─→ RankingLocksService.lock(classId, sessionId, triggeredBy, manager)  // class LOCK
              └─→ RankingRepository.logAudit(manager, {action, toVersion, …})
            })  // commit → সব একসাথে save, নাহলে সব rollback
        ⏎ return { version, studentCount, results }
  └─→ this.setJobStatus(…, 'completed', {version, studentCount})  ✅
  ⚠ throw করলে → setJobStatus('failed') → RabbitMQ backoff retry
```

### 🟨 RECALCULATE — `POST /ranking/recalculate`

GENERATE-এর প্রায় হুবহু, পার্থক্য শুধু পর্ব A-তে:

```
RankingController.recalculate(dto, userId)
  └─→ RankingService.requestRecalculate(dto, triggeredBy)
        ├─→ this.loadClassAndSession(…)
        ├─→ this.assertExamsReady(…)
        ├─→ RankingLocksService.unlock(classId, sessionId)   // ⭐ locked চেক নয় — সরাসরি unlock
        └─→ this.enqueue('RECALCULATE', dto, triggeredBy)     // পরের flow GENERATE-এর মতোই
```
> পর্ব B-তে `action==='GENERATE'` নয় বলে locked re-check/skip হয় না — সরাসরি চলে।

### 🟥 UNLOCK — `POST /ranking/unlock` (background নয়, সাথে সাথে)

```
RankingController.unlock(dto, userId)
  └─→ RankingService.unlock(classId, sessionId, actorId)
        ├─→ this.loadClassAndSession(…)
        ├─→ RankingLocksService.unlock(classId, sessionId)
        └─→ DataSource.transaction( manager =>
              RankingRepository.logAudit(manager, {action:'UNLOCK', …}) )
```

### 🟩 READ endpoint-গুলো (সাথে সাথে, engine/queue ছাড়া)

```
GET /ranking/:classId/:sessionId
  └─→ RankingService.getRanking(classId, sessionId)
        ├─→ this.loadClassAndSession(…)
        ├─→ this.getJobStatus(…) → RedisService.get(key)
        ├─→ RankingRepository.getLatestVersion(…)     // null হলে খালি ranking ফেরত
        └─→ RankingRepository.getSnapshot(…, version)

GET /ranking/:classId/:sessionId/history
  └─→ RankingService.getHistory(classId, sessionId, query)
        ├─ query.version থাকলে → RankingRepository.getSnapshot(…, version)
        └─ নাহলে             → RankingRepository.getVersionList(…)

GET /ranking/:classId/:sessionId/audit
  └─→ RankingService.getAuditLog(…) → RankingRepository.getAuditLog(…)

GET /ranking/:classId/:sessionId/job-status
  └─→ RankingService.getJobStatus(…) → RedisService.get(key)
```

> **মনে রাখবেন:** পর্ব A শেষ হওয়া মাত্র HTTP 202 চলে যায়। পর্ব B ও C
> সম্পূর্ণ আলাদা সময়ে, আলাদা RabbitMQ message হিসেবে চলে — request thread
> ততক্ষণে শেষ। তাই ফলাফল পেতে হলে GET (job-status/ranking) আবার কল করতে হয়।

---

## ৪. কেন দুই ধাপে (দুইটা queue) ভাগ করা?

একটা কাজেই তো করা যেত — তাহলে ভাগ করলাম কেন?

1. **আলাদা retry:** ধরুন roll বসানোর সময় (STEP 2) database সমস্যায় fail করলো।
   তখন শুধু STEP 2 আবার চলবে — merit হিসাব (STEP 1) নতুন করে করতে হবে না,
   কারণ সাজানো তালিকা (`rankedList`) job-এর সাথেই পাঠানো আছে।
2. **পরিষ্কার দায়িত্ব:** STEP 1 = শুধু হিসাব, STEP 2 = শুধু database লেখা।
   একটার ভুল আরেকটাকে টানে না।
3. **আলাদা monitor/scale:** প্রতিটা queue নিজের মতো করে ধীর/দ্রুত হলে আলাদাভাবে বোঝা যায়।

> এটা পুরনো Node.js project-এর `ranking queue → roll queue` chain-এর হুবহু রূপ।

---

## ৫. কাজ fail করলে কী হয়? (Retry + backoff)

- worker-এর ভেতর কিছু fail করলে আমরা **throw** করি।
- RabbitMQ তখন job-টা **আবার চেষ্টা করে**, কিন্তু সাথে সাথে না —
  একটু **অপেক্ষা করে** (exponential backoff): ২s → ৪s → ৮s...।
- সর্বোচ্চ **৩ বার** চেষ্টা করার পরও fail করলে job-টা **DLQ**
  (Dead Letter Queue — `*.jobs.dlq`)-তে রাখা হয়, যাতে হারিয়ে না যায়
  এবং পরে দেখা যায় কী সমস্যা হয়েছিল।

RabbitMQ-তে দেখা যাবে এমন queue:

```
ranking.jobs   + ranking.jobs.dlq   + ranking.jobs.delay.*   (retry delay)
roll.jobs      + roll.jobs.dlq      + roll.jobs.delay.*
```

---

## ৬. Job status কীভাবে জানব? (Redis)

কাজ background-এ হয় বলে API সাথে সাথে ফলাফল দিতে পারে না। তাই আমরা
প্রতিটা ধাপে **Redis**-এ status লিখে রাখি (key: `ranking:job:<classId>:<sessionId>`):

| status | মানে |
|--------|------|
| `queued` | queue-তে পাঠানো হয়েছে, এখনো শুরু হয়নি |
| `processing` (stage: ranking) | STEP 1 চলছে (merit হিসাব) |
| `processing` (stage: roll) | STEP 2 চলছে (roll বসানো) |
| `completed` | সব শেষ ✅ (version + studentCount সহ) |
| `failed` | fail করেছে (error message সহ) |

`GET /ranking/:classId/:sessionId` করলে এই status-ও ফলাফলের সাথে আসে।

---

## ৭. দুইটা মূল action-এর পার্থক্য

| | **GENERATE** | **RECALCULATE** |
|--|--------------|-----------------|
| endpoint | `POST /ranking/generate-roll` | `POST /ranking/recalculate` |
| কখন | প্রথমবার roll বানানো | ভুল হলে/পরিবর্তন হলে আবার বানানো |
| locked থাকলে | **থামে (409)** | আগে **unlock** করে তারপর চালায় |
| worker-এ safety | locked পেলে skip করে | সরাসরি চালায় |

আলাদা `unlock` endpoint-ও আছে — শুধু lock খোলে, নতুন করে কিছু generate করে না
(এবং সেই কাজটাও audit log-এ লেখা হয়)।

---

## ৮. Endpoint তালিকা (controller)

| Method | Path | কাজ |
|--------|------|-----|
| POST | `/ranking/generate-roll` | প্রথমবার ranking + roll (queue-তে পাঠায়, 202) |
| POST | `/ranking/recalculate` | unlock করে আবার generate (202) |
| POST | `/ranking/unlock` | শুধু lock খোলে |
| GET | `/ranking/:classId/:sessionId` | সর্বশেষ ranking + jobStatus |
| GET | `/ranking/:classId/:sessionId/history` | version list বা নির্দিষ্ট version snapshot |
| GET | `/ranking/:classId/:sessionId/audit` | কে কখন কী করলো তার লগ |

---

## ৯. এক লাইনে প্রতিটা ফাইলের দায়িত্ব

- **ranking.controller.ts** — HTTP request নেয়, service-কে ডাকে।
- **ranking.service.ts** — ম্যানেজার: যাচাই (validation), queue-তে পাঠানো,
  worker-এর জন্য `processRankingJob` / `processRollJob`, status রাখা, read।
- **ranking.repository.ts** — সব raw SQL (view থেকে merit list, roll assign,
  history save, audit, exam publish check ইত্যাদি)।
- **engine/ranking.engine.ts** — merit অনুযায়ী `rankedList` বানানোর হিসাব
  (OLD student merit + NEW student admission/FIFO, tie-break নিয়ম সহ)।
- **engine/roll.engine.ts** — এক transaction-এ roll+section assign, history save,
  lock, audit। (এখানেই database সত্যি বদলায়)।
- **queue/ranking.queue.ts** — STEP 1 job RabbitMQ-তে পাঠায়।
- **queue/roll.queue.ts** — STEP 2 job (rankedList সহ) পাঠায়।
- **job/ranking.job.ts** — STEP 1 queue শোনে, `processRankingJob` চালায়।
- **job/roll.job.ts** — STEP 2 queue শোনে, `processRollJob` চালায়।
- **entities/** — `ranking_history` ও `ranking_audit_log` table-এর TypeORM রূপ।

---

## ১০. নতুন dev হিসেবে কোথা থেকে পড়া শুরু করব?

1. এই README (শুরুতেই বড় ছবিটা বুঝে নিন)।
2. `ranking.controller.ts` — কোন endpoint কী করে।
3. `ranking.service.ts` — `requestGenerate` → `enqueue` → `processRankingJob`
   → `processRollJob` এই ক্রমে পড়ুন।
4. `engine/ranking.engine.ts` ও `engine/roll.engine.ts` — আসল হিসাব।
5. শেষে `queue/` ও `job/` — এগুলো শুধু "পাঠানো" ও "শোনা", ছোট ফাইল।
