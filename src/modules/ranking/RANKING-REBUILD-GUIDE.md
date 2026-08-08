# 🏗️ Ranking System — ০ থেকে সম্পূর্ণ Rebuild Guide

> **উদ্দেশ্য:** `ranking` + `ranking-locks` + `rabbitmq` — এই পুরো সিস্টেমটা খালি
> ফোল্ডার থেকে নিজ হাতে টাইপ করে বানানো, এবং **প্রতিটা ধাপে জানা — এখন কোন
> function কে ডাকছে, তার পরে কে ডাকা হবে**।
>
> ধারণা/থিওরি (queue কী, RabbitMQ কী, retry কেন) আগে বুঝতে চাইলে পড়ো:
> [`QUEUE-JOB-EXPLAINED.md`](QUEUE-JOB-EXPLAINED.md) — একই ফোল্ডারে।
> মডিউলের সংক্ষিপ্ত পরিচয়: [`README.md`](README.md)।
>
> পুরো প্রজেক্টের rebuild ক্রম: [`REBUILD-GUIDE.md`](../../../REBUILD-GUIDE.md)
> (repo root-এ) — সেখানে ranking সবার **শেষে**, কারণ এতে advisory lock + RabbitMQ +
> Redis + DB view সব একসাথে লাগে। এই ফাইলটা সেই শেষ ধাপটার **বিস্তারিত রূপ**।
>
> ⚠️ এই ফাইলে যত path লেখা আছে (`src/modules/ranking/…`) সেগুলো **repo root থেকে**
> ধরা — যাতে কোন ফাইলের কথা বলছি তা পরিষ্কার থাকে। ফাইলটা নিজে আছে
> `src/modules/ranking/`-এ।

---

## 📋 কী কী আগে থেকে থাকা লাগবে (prerequisite)

এগুলো না থাকলে ranking বানানো শুরুই করা যাবে না:

| লাগবে | কেন |
|---|---|
| `ConfigModule` + `TypeOrmModule` (synchronize: **false**) | DB connection |
| `RedisModule` (@Global) | job status রাখতে |
| `JwtAuthGuard`, `PermissionsGuard`, `@Permissions()`, `@CurrentUser()` | route পাহারা |
| `classes`, `academic-sessions` module (repository export করা) | validation |
| `students`, `student-enrollments`, `sections` entity | roll কোথায় বসবে |
| `exams`, `exam-results` entity (`ExamType`, `ExamStatus` enum সহ) | নম্বর কোথা থেকে আসবে |
| Docker-এ RabbitMQ চালু (5672 / UI 15672) | queue |

---

## 🗺️ পুরো রাস্তার ম্যাপ — ১২ ধাপ

```
ধাপ ১  ── DB: টেবিল + VIEW (migration)          ← ভিত্তি, কোনো TS কোড নেই
ধাপ ২  ── config/rabbitmq.config.ts             ← শুধু সংখ্যা
ধাপ ৩  ── common/rabbitmq/  (service + module)  ← ডাকঘর বানানো
ধাপ ৪  ── ranking-locks module (পুরোটা)         ← ছোট, স্বয়ংসম্পূর্ণ, আগে শেষ করো
ধাপ ৫  ── ranking/entities/ + dto/              ← আকার (shape)
ধাপ ৬  ── ranking/ranking.constants.ts          ← queue নাম + payload টাইপ
ধাপ ৭  ── ranking/ranking.repository.ts         ← সব DB কথা
ধাপ ৮  ── ranking/engine/ranking.engine.ts      ← হিসাব ১: rankedList
ধাপ ৯  ── ranking/engine/roll.engine.ts         ← হিসাব ২: roll + transaction
ধাপ ১০ ── ranking/queue/*.queue.ts              ← producer (৩ লাইন)
ধাপ ১১ ── ranking/ranking.service.ts            ← ম্যানেজার (সব জোড়া লাগে)
ধাপ ১২ ── ranking/job/*.job.ts + controller + module  ← worker + দরজা + রেজিস্ট্রেশন
```

**নিয়ম:** নিচ থেকে উপরে বানাও — যে ফাইলের উপর অন্যরা দাঁড়ায়, সেটা আগে।
তাই controller সবার শেষে। এতে কখনো "এই function তো এখনো নেই" সমস্যায় পড়বে না।

---

## ধাপ ১ — Database (কোনো TypeScript নেই)

migration-এ এই তিনটা টেবিল + একটা VIEW:

```sql
-- ১. প্রতিবার generate-এর immutable snapshot
ranking_history (
  id uuid PK, academic_session_id uuid, class_id uuid, student_id uuid,
  total_score numeric(7,2), rank_position int, roll_number int,
  version int DEFAULT 1, generated_at timestamp DEFAULT now()
)

-- ২. প্রতি class+session-এ একটাই সারি
ranking_locks (
  id uuid PK, class_id uuid, academic_session_id uuid,
  is_locked bool DEFAULT false, locked_at timestamp NULL, locked_by uuid NULL,
  created_at, updated_at,
  UNIQUE (class_id, academic_session_id)     -- ⚠️ upsert-এর ON CONFLICT এর উপর দাঁড়ায়
)

-- ৩. কে/কখন/কী করল
ranking_audit_log (
  id uuid PK, action ranking_action_enum, class_id uuid, academic_session_id uuid,
  actor_id uuid NULL, from_version int NULL, to_version int NULL,
  detail jsonb NULL, created_at
)

-- ৪. VIEW — পুরোনো ছাত্রদের merit list (RANK() window + tie-break)
CREATE VIEW public.student_merit_list AS
  SELECT student_id, class_id, academic_session_id,
         total_score, final_score, midterm_score,
         admission_date, enrollment_created_at,
         RANK() OVER (PARTITION BY class_id, academic_session_id
                      ORDER BY total_score DESC, final_score DESC, ...) AS rank_position
  FROM ... exam_results + exams + student_enrollments join ...
```

আর permission গুলো seed করো: `RANKING_GENERATE`, `RANKING_RECALCULATE`,
`RANKING_UNLOCK`, `RANKING_READ`, `RANKING_ADMIN`।

> 💡 **VIEW কেন?** merit-এর জটিল SQL (window function, tie-break) অ্যাপে লিখলে
> প্রতিবার বদলাতে deploy লাগবে। VIEW-এ থাকলে repository শুধু `SELECT * FROM view`
> করে — কোড পরিষ্কার থাকে, আর Postgres হিসাবটা নিজে optimize করে।

✅ **এই ধাপ শেষে:** psql-এ `SELECT * FROM student_merit_list LIMIT 5;` চলে।

---

## ধাপ ২ — `src/config/rabbitmq.config.ts`

```ts
export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  prefetch: parseInt(process.env.RABBITMQ_PREFETCH ?? '5', 10),
  maxDelayMs: parseInt(process.env.RABBITMQ_MAX_DELAY_MS ?? '60000', 10),
}));
```

`app.module.ts`-এর `ConfigModule.forRoot({ load: [...] })`-এ যোগ করো।

---

## ধাপ ৩ — `src/common/rabbitmq/` (ডাকঘর)

এই একটাই ফাইল পুরো প্রজেক্টের queue-ইনফ্রা। **ঠিক এই ক্রমে** টাইপ করো —
প্রতিটা আগেরটার উপর দাঁড়ায়:

| # | Method | কাজ | কে ডাকে |
|---|---|---|---|
| 1 | `onModuleInit()` | `connect()` ডাকে | NestJS নিজে, app boot-এ |
| 2 | `connect()` | connection খোলে + listener বসায়; `close` হলে ৫s পর নিজেকে আবার ডাকে | `onModuleInit`, নিজে (reconnect) |
| 3 | `setupChannels()` | `pubChannel` (confirm) + `subChannel` তৈরি, exchange assert, prefetch, প্রতিটা channel-এ `error`/`close` listener, শেষে `registrations`-এর সব setup আবার চালায় | `connect`, `scheduleChannelRebuild` |
| 4 | `scheduleChannelRebuild()` | channel মরলে একবারই rebuild চালায় | channel `close` listener |
| 5 | `encode()` / `toError()` / `tryDecode()` | ছোট helper | নানা জায়গা |
| 6 | `confirmPublish()` / `confirmSendToQueue()` | confirm channel-এ publish — broker ack করলে resolve | `publish`, `scheduleRetry`, `parkInDlq`, `replayDlq` |
| 7 | `publish(queue, payload)` | assertQueue → bindQueue → confirmPublish, হেডার `x-attempts: 0` সহ | producer class গুলো |
| 8 | `registerConsumer(queue, handler, opts)` | ভেতরে `setup` closure বানায় (queue + dlq assert, bind, `ch.consume`) → `registrations`-এ push → channel থাকলে এখনই চালায় | worker (`*.job.ts`) `onModuleInit`-এ |
| 9 | `handleMessage(...)` | 🧠 **হৃদয়** — JSON parse → `handler()` → সফল হলে `ack`; ব্যর্থ হলে attempt গুনে retry বা DLQ | `ch.consume` callback |
| 10 | `computeBackoff(attempt, base, max)` | `min(max, base×2^(n-1))` → অর্ধেক fixed + অর্ধেক random → 250ms bucket-এ round | `handleMessage` |
| 11 | `scheduleRetry(...)` | `<queue>.delay.v2.<ms>` queue বানায় (`x-message-ttl` + DLX + `x-expires`) → সেখানে পাঠায় | `handleMessage` |
| 12 | `parkInDlq(...)` | `<queue>.dlq`-তে পাঠায়, confirm-এর পরে ack | `handleMessage` (দুই জায়গায়) |
| 13 | `safeAck` / `safeNack` | channel এখনো একই কিনা দেখে তারপর ack/nack | `handleMessage`, `parkInDlq` |
| 14 | `withTempChannel()` | প্রতি কলে নতুন channel, শেষে বন্ধ | `peekDlq`, `replayDlq` |
| 15 | `peekDlq` / `replayDlq` | admin tooling — inspect ও ফেরত পাঠানো | service (DLQ endpoint) |

### তিনটা channel কেন?

AMQP-তে একটা channel error **গোটা channel** বন্ধ করে দেয়। এক channel-এ publish আর
consume রাখলে publish-এর একটা ভুল সব consumer-কে মেরে ফেলে।

| Channel | কাজ |
|---|---|
| `pubChannel` (confirm) | সব publish — broker নিশ্চিত করার পরই resolve |
| `subChannel` | শুধু consume + ack/nack |
| temp channel (প্রতি কলে) | DLQ peek/replay — error হলে শুধু ওই কাজটাই ফেলে দেয় |

> ⚠️ **`channel.on('error')` ও `channel.on('close')` ভুলবে না।** channel connection
> থেকে **আলাদাভাবে** মরতে পারে (যেমন `PRECONDITION_FAILED`)। তখন connection বেঁচে
> থাকে, তাই connection-এর `close` handler কখনো চলে না — আর সব consumer **কোনো error
> log ছাড়াই** চুপচাপ মরে যায়। Job জমতে থাকে, কেউ বুঝতে পারে না কেন কিছু হচ্ছে না।
> এটাই খুঁজে পাওয়া সবচেয়ে কঠিন ধরনের bug।

### `handleMessage` — শাখা-প্রশাখা (এটাই মূল লজিক)

```
message এল
  │
  ├─ attempts = headers['x-attempts'] ?? 0
  │
  ├─ JSON.parse ব্যর্থ?  → parkInDlq(...)   [poison message — retry-তে কখনো সফল হবে না]
  │
  ├─ await handler(payload)        ← এখানেই তোমার ব্যবসার কোড চলে
  │
  ├─ ✅ সফল  → safeAck(msg)                      [শেষ]
  │
  └─ ❌ throw → nextAttempts = attempts + 1
        ├─ nextAttempts >= maxAttempts ?
        │     → parkInDlq(queue, msg, ...)        [DLQ-তে পার্ক]
        │
        ├─ না হলে
        │     → delay = computeBackoff(nextAttempts, base, max)
        │     → await scheduleRetry(...)   ← confirm আসা পর্যন্ত অপেক্ষা
        │     → safeAck(msg)                      [delay queue-তে; TTL শেষে ফিরে আসবে]
        │
        └─ কপি পাঠাতেই ব্যর্থ?  → safeNack(requeue)  [ack করব না — job হারাবে না]
```

> ⚠️ **দুইটা জিনিস এখানে জরুরি:**
>
> **(১) মূল message-কে `ack` করা হয়, `nack` নয়** — কারণ আমরা নিজেরাই নতুন কপি
> (delay queue বা dlq-তে) বানিয়ে ফেলেছি। `nack` করলে RabbitMQ সাথে সাথে আবার একই
> message দিত, তখন delay-এর কোনো মানে থাকত না।
>
> **(২) কপি broker-এ পৌঁছেছে — এই নিশ্চিত হওয়ার *পরেই* ack।** তাই confirm channel।
> আগে confirm ছাড়া ack হতো, ফলে মাঝপথে connection মরলে job একেবারে হারিয়ে যেতে পারত।
> কপি পাঠাতেই ব্যর্থ হলে ack না করে nack — message queue-তে ফিরে যায়।

তারপর `rabbitmq.module.ts` — `@Global()` করে দাও, যাতে যেকোনো module ইনজেক্ট করতে পারে।

✅ **টেস্ট:** app চালাও → log-এ `RabbitMQ connected` দেখা যাবে,
আর http://localhost:15672 -এ exchange `app.jobs` দেখা যাবে।

---

## ধাপ ৪ — `ranking-locks` module (পুরোটা শেষ করো)

ছোট আর স্বয়ংসম্পূর্ণ — তাই ranking শুরুর আগেই শেষ করে ফেলো।

**ক্রম:** entity → repository → service → controller → module

### `entities/ranking-lock.entity.ts`
`@Entity('ranking_locks')` — `classId`, `academicSessionId`, `isLocked`, `lockedAt`,
`lockedBy` + তিনটা `@ManyToOne` (class, session, lockedByUser)।
এই টেবিলে `deleted_at` নেই → **soft-delete নেই**।

### `ranking-locks.repository.ts` — ৫টা method

```
exec(manager?)                    → manager ?? this.repo.manager      [private helper]
findByClassAndSession(...)        → findOne + relations
isLocked(class, session, mgr?)    → exec(mgr).getRepository(...).findOne → isLocked === true
lock(class, session, by, mgr?)    → writeLock(..., true,  by)
unlock(class, session, mgr?)      → writeLock(..., false, null)
writeLock(...)  [private]         → INSERT ... ON CONFLICT (class_id, academic_session_id)
                                    DO UPDATE ... RETURNING *
```

> 💡 **সবচেয়ে গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত:** প্রতিটা method-এ
> **optional `manager?: EntityManager`** — write **আর read দুটোতেই**। কারণ:
>
> - `RollEngine` তার নিজের transaction-এর ভেতর থেকে `lock()` ডাকবে, তখন নিজের
>   manager পাস করবে — lock একই transaction-এ commit হবে। এটা না করলে roll বসল
>   কিন্তু lock হলো না — এমন অর্ধেক-অবস্থা তৈরি হতে পারত।
> - `isLocked()`-ও manager নেয়, কারণ advisory lock ধরে রেখে **transaction-এর
>   ভেতর থেকে** পড়াটাই একমাত্র নির্ভরযোগ্য check (নিচে ধাপ ৯ দেখো)।
>
> manager না দিলে সাধারণ connection ব্যবহার হয়।
>
> `() => 'NOW()'` লেখার কারণ — timestamp **DB-এর ঘড়িতে** বসবে, app সার্ভারের ঘড়িতে নয়।
> `.returning('*')` — এক round-trip-এ পুরো সারি ফেরত, আলাদা `SELECT` লাগে না।

### `ranking-locks.service.ts` — ৪টা method
`getStatus` (row না থাকলে `isLocked: false` ধরে), `isLocked`, `lock`, `unlock` —
সবগুলো repository-তে pass-through।

### `ranking-locks.controller.ts` — একটাই route
`GET /ranking-locks/:classId/:academicSessionId` → `getStatus`।
**lock/unlock করার route এখানে নেই** — সেগুলো ranking module-এ (`POST /ranking/unlock`,
আর generate-এর auto-lock)। এখানে শুধু "দেখা"।

### `ranking-locks.module.ts`
`exports: [RankingLocksService, RankingLocksRepository]` ← **export করা লাগবে**,
নইলে ranking module ব্যবহার করতে পারবে না।

✅ **টেস্ট:** `GET /ranking-locks/<classId>/<sessionId>` → `{ isLocked: false }`

---

## ধাপ ৫ — `ranking/entities/` + `ranking/dto/`

**Entity (২টা):**
- `ranking-history.entity.ts` — `version`, `rankPosition`, `rollNumber`, `totalScore`
  (numeric → number `transformer` সহ), `generatedAt`। **immutable** — কখনো update হয় না।
- `ranking-audit-log.entity.ts` — `RankingAction` enum (GENERATE, RECALCULATE, UNLOCK,
  LOCK, AUTO_TRIGGER, AUTO_TRIGGER_SKIP) + `detail: jsonb`।

**DTO (৪টা):**
- `generate-roll.dto.ts` — `classId`, `academicSessionId` (দুটোই `@IsUUID()`)
- `recalculate.dto.ts` — `extends GenerateRollDto` (ইনপুট একই)
- `unlock.dto.ts` — শুধু classId + sessionId
- `history-query.dto.ts` — `version?` (`@Type(() => Number)` লাগবে, কারণ query
  string সবসময় text হয়ে আসে)

> 💡 **DTO-তে যা রাখবে না — এক:** `triggeredBy` / `actorId`। ওটা JWT থেকে
> `@CurrentUser('id')` দিয়ে সার্ভার নিজে নেবে। client-কে "আমি কে" বলতে দিলে
> সে অন্যের নামে কাজ চালিয়ে দিতে পারবে।
>
> 💡 **দুই: `sectionId`ও নয়।** ranking সবসময় পুরো class+session-এর উপর চলে।
> section হলো ranking-এর *ফলাফল* (capacity অনুযায়ী বিতরণ), ইনপুট নয়। আর
> `ranking_history`-এর version পুরো class ধরে গোনা হয় — এক section-এর জন্য generate
> করলে সেই version-এর snapshot-এ ক্লাসের বাকি ছাত্ররা হারিয়ে যেত।
> `forbidNonWhitelisted: true` চালু আছে, তাই কেউ পাঠালে পরিষ্কার 400 পাবে।

---

## ধাপ ৬ — `ranking/ranking.constants.ts`

```ts
export const RANKING_QUEUE = 'ranking.jobs';   // STEP 1
export const ROLL_QUEUE    = 'roll.jobs';      // STEP 2

export interface RankingJobPayload {           // STEP 1-এ যা যায়
  action: 'GENERATE' | 'RECALCULATE';
  classId; academicSessionId; triggeredBy;     // sectionId নেই — ধাপ ৫ দেখো
}

// RollEngine শুধু এই তিনটা field ব্যবহার করে — পুরো RankedEntry পাঠালে
// message প্রায় দ্বিগুণ হতো, আর প্রতি retry-তে delay queue-তে আরেক কপি জমত
export type RollListEntry = Pick<RankedEntry,
  'studentId' | 'rankPosition' | 'totalScore'>;

export interface RollJobPayload extends RankingJobPayload {
  rankedList: RollListEntry[];                 // STEP 1 যা হিসাব করল
}
export type RankingJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
```

ছোট ফাইল, কিন্তু **contract** — producer, consumer, service সবাই এটা মেনে চলে।

---

## ধাপ ৭ — `ranking/ranking.repository.ts` (সব DB কথা এক জায়গায়)

তিন দলে ভাগ করে টাইপ করো:

### দল ক — validation
```
isExamPublished(classId, sessionId, 'FINAL' | 'ADMISSION') → boolean
   examRepo.count({ status: PUBLISHED })   ← count() soft-deleted বাদ দেয় নিজেই
```

> ⚠️ **টাইপ ঘোষণায় ফাঁদ:** raw query ও `getRawMany()` — দুটোতেই `date`/`timestamp`
> কলাম **JS `Date` object** হয়ে আসে (`pg-types` OID 1082/1114-এর জন্য parser
> রেজিস্টার করে, TypeORM সেটা override করে না)। তাই `MeritRow.admission_date`-কে
> `string` লিখলে TypeScript মিথ্যা বলবে — `string | Date | null` লেখো। এই ভুল
> টাইপের কারণেই engine-এ `!==` তুলনা ভেঙে যেত (ধাপ ৮ দেখো)।

### দল খ — ranking-এর কাঁচামাল (পড়া)
```
getMeritList(classId, sessionId)                 → VIEW student_merit_list (raw SELECT)
getNewStudents(classId, sessionId, excludeIds)   → merit-এ নেই এমন enrolled ছাত্র, FIFO ক্রমে
getAdmissionScores(classId, sessionId, ids)      → ADMISSION exam-এর SUM(marks) per student
getSectionsForClass(classId)                     → section + max_capacity, নাম ক্রমে
```

> ⚠️ **দুইটা ফাঁদ, দুটোই এখানে আছে:**
> 1. `getNewStudents`-এ — `NOT IN (:...ids)` খালি array পেলে SQL **ভেঙে যায়**।
>    তাই `if (excludeIds.length > 0)` দিয়ে শর্তটা যোগ করা হয়।
> 2. `getAdmissionScores`-এ — `studentIds.length === 0` হলে সাথে সাথে `[]` ফেরত,
>    query-ই চালানো হয় না। একই কারণ।

### দল গ — লেখা (সবগুলোতে `manager` **আবশ্যক**)
```
advisoryLock(manager, classId, sessionId)        → SELECT pg_advisory_xact_lock(hashtext($1))
getNextVersion(manager, ...)                    → COALESCE(MAX(version), 0) + 1
assignRollAndSection(manager, classId, sessionId, studentId, roll, sectionId)
                                                → UPDATE student_enrollments → boolean
saveHistoryRow(manager, row)                    → INSERT ranking_history
logAudit(manager, data)                         → INSERT ranking_audit_log
```

> ⚠️ **`assignRollAndSection`-এর WHERE-এ `class_id` রাখতেই হবে**, শুধু
> `student_id + academic_session_id` নয়। rankedList তৈরি হওয়ার (STEP 1) আর roll
> বসানোর (STEP 2) মাঝে ছাত্র অন্য ক্লাসে সরে গেলে না হলে ভুল ক্লাসের enrollment-এ
> roll বসে যেত। এখন `affected = 0` হবে, আর সে snapshot-এও যাবে না।

### দল ঘ — read API-র জন্য
```
getLatestVersion(classId, sessionId)   → MAX(version) | null
getSnapshot(classId, sessionId, ver)   → history + student + user join (নাম, code সহ)
getVersionList(classId, sessionId)     → version, student_count, generated_at
getAuditLog(classId, sessionId)        → শেষ ১০০টা log
```

> 💡 **কেন `assignRollAndSection` boolean ফেরত দেয়?** কোনো ছাত্র withdrawn হয়ে গেলে
> (soft-deleted enrollment) UPDATE কোনো row ছুঁতে পারবে না → `affected = 0` → `false`।
> তখন RollEngine তাকে history snapshot-এও লিখবে না। মানে **enrollment-এ যা নেই,
> snapshot-এও তা নেই** — দুটো সবসময় মিলে থাকে।

---

## ধাপ ৮ — `ranking/engine/ranking.engine.ts` (হিসাব ১)

শুধু গণিত। কোনো DB write নেই, কোনো lock নেই, কোনো queue নেই।

```
buildCombinedRanking(classId, sessionId, admissionTestEnabled) : RankedEntry[]
│
├─ ১. repo.getMeritList()          → oldList  (VIEW-এর rank_position সহ আসে)
├─ ২. meritIds = oldList-এর সব id
├─ ৩. repo.getNewStudents(exclude: meritIds) → newStudents
│
├─ 🔀 Scenario 1 — admissionTestEnabled === false
│      নতুনদের score 0, rank = oldList.length + 1, + 2, + 3 … (FIFO)
│      return [...oldList, ...fifo]          ← sort করা হয় না! পুরোনোরা আগেই থাকে
│
└─ 🔀 Scenario 2 — admissionTestEnabled === true
       ├─ repo.getAdmissionScores(newIds) → scoreMap
       ├─ newList বানাও (totalScore = admission score)
       └─ return sortAndRank([...oldList, ...newList])   ← সবাই একসাথে প্রতিযোগিতায়

toTime(value)  [module-level helper]
   Date | string | null → number   (null/invalid = Number.MAX_SAFE_INTEGER, সবার শেষে)

sortAndRank(list)  [private]
   ৬ ধাপের tie-break: totalScore ↓ → finalScore ↓ → midScore ↓
                     → toTime(admissionDate) ↑      ← number-এ নামিয়ে তুলনা
                     → toTime(enrollmentCreatedAt) ↑ → studentId ↑
   তারপর forEach দিয়ে rankPosition = index + 1
```

> 💡 **শেষ tie-break `studentId` কেন?** যাতে ফলাফল **deterministic** হয় — একই
> ডেটায় দুইবার চালালে হুবহু একই তালিকা আসবে। নইলে দুইজনের সবকিছু সমান হলে
> প্রতিবার এলোমেলো ক্রম আসত, আর "কেন রোল বদলে গেল?" প্রশ্নের উত্তর থাকত না।

> ⚠️ **`toTime()` কেন লাগে — খুব সূক্ষ্ম কিন্তু মারাত্মক ফাঁদ।** তারিখগুলো `Date`
> object (ধাপ ৭ দেখো)। সরাসরি `a.admissionDate !== b.admissionDate` লিখলে সেটা
> **reference** তুলনা — একই তারিখেও সবসময় `true`। ফলে:
>
> ```
> compare(a, b) = 1   এবং   compare(b, a) = 1     ← একইসাথে!
> ```
>
> এতে `Array.sort()`-এর নিয়ম ভাঙে (ফলাফল অস্থির), আর পরের tie-break গুলো
> (`enrollmentCreatedAt`, `studentId`) **কখনো চলেই না** — অথচ `studentId` রাখা
> হয়েছিল ঠিক determinism-এর জন্যই। বাস্তবে যখন কামড় দেয়: একই দিনে ভর্তি হওয়া ২০
> জন নতুন ছাত্রের ক্রম — আর তাদের রোল — প্রতিবার বদলে যেতে পারে।
>
> **নিয়ম:** date/timestamp কখনো `===`/`!==` দিয়ে তুলনা করবে না। সবসময় `getTime()`
> বা `Date.parse()` দিয়ে number-এ নামিয়ে নাও।
>
> 💡 **Engine আলাদা কেন?** এতে কোনো I/O নেই বলে unit test করা সহজ — ইনপুট দাও,
> আউটপুট মেলাও। DB/queue লাগে না।

---

## ধাপ ৯ — `ranking/engine/roll.engine.ts` (হিসাব ২ + transaction)

```
generateRolls(input, rankedList, triggeredBy, action)
│
├─ sections = repo.getSectionsForClass()            ← TX-এর বাইরে (শুধু পড়া)
│
└─ dataSource.transaction(async manager => {        ═══ BEGIN ═══
     ১. repo.advisoryLock(manager, ...)             🚪 দরজা বন্ধ
     ২. action === GENERATE হলে:
          locked = locksService.isLocked(..., manager)     ← ⭐ চূড়ান্ত check
          locked? → return { skipped: true, version: null, ... }   [কিছুই লেখা হলো না]
     ৩. assignments = this.assignRolls(rankedList, sections)   [private]
     ৪. version = repo.getNextVersion(manager, ...)
     ৫. for (const a of assignments) {
          updated = repo.assignRollAndSection(manager, classId, ...)
          if (!updated) continue;                   ← withdrawn / ক্লাস বদল → skip
          repo.saveHistoryRow(manager, {...version})
          saved.push(a)
        }
     ৬. locksService.lock(class, session, triggeredBy, manager)   🔒 একই TX-এ!
     ৭. repo.logAudit(manager, { action, toVersion: version, detail })
     return { skipped: false, version, studentCount: saved.length, results: saved }
   })                                               ═══ COMMIT ═══
```

> ⭐ **ধাপ ২ — advisory lock নেওয়ার *পরে* lock re-check কেন?** এটাই duplicate
> generate ঠেকানোর একমাত্র নির্ভরযোগ্য জায়গা।
>
> `requestGenerate`-এ lock চেক আছে, কিন্তু সেটা কিছু *সংরক্ষণ* করে না। দুইবার
> ক্লিক করলে দুটো request-ই চেক পাশ করে, দুটো job queue-তে যায়। worker-এর
> শুরুর চেকও দুজনেই পাশ করে যেতে পারে — কারণ প্রথমজনের transaction তখনো commit
> হয়নি। `advisoryLock` শুধু তাদের **লাইনে দাঁড় করায়**, থামায় না।
>
> এখানে দ্বিতীয়জন লাইন থেকে ঢুকে দেখে lock বসে গেছে → কিছু না লিখে বেরিয়ে যায়।
> নইলে একই ডেটার version 1 আর version 2 — দুইটা কপি তৈরি হতো।
> `RECALCULATE` ইচ্ছাকৃতভাবে locked অবস্থার উপরেই চলে, তাই check শুধু GENERATE-এর।

### `assignRolls` — দুই রকম

```
sections.length <= 1
    → roll = rankPosition  (১, ২, ৩ … ক্লাসজুড়ে একটানা)

একাধিক section
    → caps = effectiveCapacities(sections, ranked.length)
      si = 0, rollInSection = 0
      প্রতি ছাত্রে: বর্তমান section ভরে গেলে (rollInSection >= caps[si])
                    পরের section-এ যাও, rollInSection আবার ০
      roll = rollInSection + 1   (প্রতি section-এ আবার ১ থেকে শুরু)
      ⚠️ while শর্তে `si < sections.length - 1` → শেষ section সব overflow শোষণ করে
         (নইলে capacity ছাড়িয়ে গেলে ছাত্র কোথাও বসত না)
```

### `effectiveCapacities` — `max_capacity = NULL` সামলানো

`NULL` মানে "সীমা দেওয়া হয়নি"। এটাকে সোজা **অসীম** ধরলে সেই section তার পরের সব
section খালি রেখে **পুরো ক্লাস শুষে নিত**। তাই NULL section গুলো নির্দিষ্ট capacity
বাদ দিয়ে বাকি ছাত্রদের সমান ভাগ পায়:

```
fairShare = ceil( max(0, মোট ছাত্র − যোগফল(নির্দিষ্ট capacity)) / NULL section সংখ্যা )
```

> 💡 **ধাপ ৬ (lock) transaction-এর ভেতরে কেন?** ভাবো যদি বাইরে থাকত — roll বসে
> COMMIT হয়ে গেল, তারপর lock করতে গিয়ে সার্ভার ক্র্যাশ করল। এখন roll বসানো আছে
> কিন্তু lock নেই → কেউ আবার generate করে ফেলবে, roll বদলে যাবে। ভেতরে রাখলে
> **হয় দুটোই, নয় কোনোটাই।**

---

## ধাপ ১০ — `ranking/queue/*.queue.ts` (producer)

সবচেয়ে সহজ ফাইল — প্রতিটা মাত্র একটা method:

```ts
@Injectable() export class RankingQueue {
  constructor(private readonly rabbitmq: RabbitMQService) {}
  publish(payload: RankingJobPayload) { return this.rabbitmq.publish(RANKING_QUEUE, payload); }
}
// RollQueue — হুবহু একই, শুধু ROLL_QUEUE + RollJobPayload
```

> 💡 **এত পাতলা wrapper কেন, সরাসরি `rabbitmq.publish()` ডাকলেই তো হতো?** দুইটা লাভ:
> queue-এর নামটা এক জায়গায় বাঁধা থাকে (টাইপো করে ভুল queue-তে পাঠানোর সুযোগ নেই),
> আর payload-টা **type-checked** হয়। পরে RabbitMQ বদলে Kafka করলেও শুধু এই ফাইলটা বদলাবে।

---

## ধাপ ১১ — `ranking/ranking.service.ts` (ম্যানেজার)

সব জোড়া লাগার জায়গা। **ঠিক এই ক্রমে** টাইপ করো — নিচের helper গুলো আগে বানালে
উপরের method লেখার সময় সব রেডি পাবে:

### প্রথমে helper (৬টা)
```
jobKey(classId, sessionId)               → `ranking:job:${classId}:${sessionId}`
setJobStatus(class, session, status, extra) → redis.setEx(key, JSON, 86400)
trySetJobStatus(...)                     → setJobStatus, কিন্তু কখনো throw করে না
getJobStatus(class, session)             → redis.get → JSON.parse | null
loadClassAndSession(class, session)      → classes ✓ session ✓ → admissionTestEnabled ফেরত
assertExamsReady(class, session, admEnabled) → FINAL published? (+ ADMISSION হলে) নইলে 400
```

> 💡 `loadClassAndSession` একইসাথে **দুইটা কাজ করে** — অস্তিত্ব যাচাই (না থাকলে 404)
> আর `admissionTestEnabled` ফেরত দেওয়া। একবার DB-তে গিয়ে দুটোই সারা।

> ⚠️ **`trySetJobStatus` কেন আলাদা লাগে?** দুই জায়গায় status লেখা **কখনোই** throw
> করা চলবে না:
>
> 1. **`catch` ব্লকের ভেতরে** — Redis down থাকলে এই লেখাটাই throw করে **আসল
>    error ঢেকে দিত**। log-এ "Redis timeout" দেখতে, প্রকৃত কারণ নয়।
> 2. **কাজ commit হয়ে যাওয়ার পরে** — তখন throw করলে RabbitMQ পুরো job আবার
>    চালাত, আর একই ডেটার **আরেকটা version** তৈরি হতো। status হারানো তুচ্ছ ক্ষতি;
>    কাজ দুইবার হওয়া নয়।

### তারপর WRITE (৩টা)
```
requestGenerate(dto, triggeredBy)
  ├─ loadClassAndSession()          → 404?
  ├─ locksService.isLocked()        → 409 ConflictException
  ├─ assertExamsReady()             → 400 BadRequest
  └─ enqueue('GENERATE', dto, by)

requestRecalculate(dto, triggeredBy)
  ├─ loadClassAndSession()
  ├─ assertExamsReady()
  └─ enqueue('RECALCULATE', dto, by)     ← lock চেক করে না, খোলেও না

enqueue(action, dto, by)   [private]
  ├─ setJobStatus(..., 'queued')
  ├─ try { rankingQueue.publish(payload) }
  │  catch { trySetJobStatus('failed', stage:'enqueue'); throw }
  └─ return { status: 'queued', message: '...' }
```

> ⚠️ **`requestRecalculate` আগে থেকে `unlock()` করে না** (একসময় করত)। কারণ publish
> ব্যর্থ হলে ক্লাস **unlocked অবস্থায় পড়ে থাকত** পুরনো roll নিয়ে, আর যে কেউ তখন
> `generate-roll` চালিয়ে দিতে পারত। দরকারও নেই — `RollEngine` কাজ শেষে lock নতুন
> করে বসায়, আর worker-এর lock check শুধু GENERATE-এর জন্য।
>
> ⚠️ **`enqueue`-এ ক্রম আর error path দুটোই গুরুত্বপূর্ণ:** status **আগে** লিখতে হবে
> (নইলে worker-এর `processing` পরে এসে `queued` দিয়ে overwrite হয়ে যেতে পারে), আর
> publish ব্যর্থ হলে status পরিষ্কার করতে হবে — নইলে queue-তে কিছু না থাকা সত্ত্বেও
> ইউজার **চিরকাল `queued`** দেখে poll করতে থাকবে।

### তারপর WORKER entry point (২টা) — এগুলোই job ফাইল ডাকবে
```
processRankingJob(payload)                          ← STEP 1
  ├─ setJobStatus('processing', stage: 'ranking')
  ├─ try {
  │    ├─ loadClassAndSession()
  │    ├─ action === 'GENERATE' হলে isLocked() — দ্রুত skip (ভারী হিসাব বাঁচে)
  │    │     locked? → setJobStatus('completed', skipped: 'already-locked') → return
  │    ├─ rankingEngine.buildCombinedRanking()   → ranked (পুরো RankedEntry)
  │    ├─ rankedList = ranked.map(→ studentId, rankPosition, totalScore)   ← slim
  │    └─ rollQueue.publish({ ...payload, rankedList })     ➜ STEP 2-এ হস্তান্তর
  │  } catch {
  │    ├─ trySetJobStatus('failed', stage: 'ranking', error)
  │    └─ throw err      ⚠️ throw করা *আবশ্যক* — নইলে RabbitMQ retry হবে না
  │  }

processRollJob(payload)                             ← STEP 2
  ├─ setJobStatus('processing', stage: 'roll')
  ├─ try { result = rollEngine.generateRolls(...) }
  │  catch { trySetJobStatus('failed', stage: 'roll'); throw err }
  │
  └─ ⚠️ এই বিন্দুর পরে COMMIT হয়ে গেছে — আর কখনো throw নয়
     trySetJobStatus('completed', result.skipped
        ? { skipped: 'already-locked' }
        : { version, studentCount })
```

> ⚠️ **সবচেয়ে বড় ভুল যেটা নতুনরা করে:** catch-এ error গিলে ফেলা (`throw` না করা)।
> তখন `handleMessage` ভাববে কাজ সফল হয়েছে, `ack` করে দেবে, আর job **চুপচাপ হারিয়ে
> যাবে** — না retry, না DLQ, না কোনো খবর। **catch-এ status লেখো, তারপর আবার throw করো।**

> 💡 **`processRankingJob`-এ lock আবার চেক করা কেন?** `requestGenerate`-এ তো চেক
> করেছিলাম! কিন্তু job queue-তে ১০ সেকেন্ড বসে ছিল — এর মাঝে অন্য কেউ generate করে
> lock করে ফেলতে পারে। তাই worker কাজ শুরুর আগে আরেকবার দেখে। এটাকে বলে
> **TOCTOU** (Time-Of-Check to Time-Of-Use) সমস্যা — চেক আর ব্যবহারের মাঝের ফাঁক।
>
> কিন্তু **এই চেকটাও যথেষ্ট নয়** — এটা শুধু একটা optimization (locked হলে ভারী
> হিসাবটা বাঁচে)। দুইটা job একসাথে চললে দুজনেই এখানে "খোলা আছে" দেখতে পারে, কারণ
> কারও transaction তখনো commit হয়নি। **চূড়ান্ত সিদ্ধান্ত হয় ধাপ ৯-এ** — advisory
> lock ধরে রেখে, transaction-এর ভেতরে। TOCTOU-এর ফাঁক পুরোপুরি বন্ধ করতে চেক আর
> লেখা — দুটোকে **একই lock-এর ভেতরে** আনতে হয়।

### তারপর READ (৪টা) + DLQ admin (২টা)
```
getRanking(class, session)      → loadClassAndSession → getJobStatus → getLatestVersion
                                  → null হলে ranking: [] ; নইলে getSnapshot()
getHistory(class, session, q)   → q.version থাকলে getSnapshot, নইলে getVersionList
getAuditLog(class, session)     → repo.getAuditLog
unlock(class, session, actorId) → এক TX-এ: locksService.unlock(mgr) + logAudit(mgr)

getDeadLetters()     → Promise.all([peekDlq(RANKING_QUEUE), peekDlq(ROLL_QUEUE)])
                       → { ranking: DlqPage, roll: DlqPage, total }
replayDeadLetters()  → Promise.all([replayDlq(RANKING_QUEUE), replayDlq(ROLL_QUEUE)])
```

> ⚠️ **`unlock` — দুটো কাজ একই transaction-এ।** `locksService.unlock()` TX-এর বাইরে
> রেখে শুধু `logAudit`-কে ভেতরে রাখলে, audit insert ব্যর্থ হলে **lock খুলে যেত কিন্তু
> কোনো রেকর্ড থাকত না** — "কে খুলল?" প্রশ্নের উত্তর হারিয়ে যেত। audit log-এর পুরো
> উদ্দেশ্যই তখন ব্যর্থ। দুটোকে একসাথে রাখলে হয় দুটোই, নয় কোনোটাই।

---

## ধাপ ১২ — worker + controller + module (শেষ)

### `job/ranking.job.ts` ও `job/roll.job.ts`

```ts
@Injectable() export class RankingJob implements OnModuleInit {
  constructor(private rabbitmq: RabbitMQService, private rankingService: RankingService) {}
  async onModuleInit() {
    await this.rabbitmq.registerConsumer<RankingJobPayload>(
      RANKING_QUEUE,
      (payload) => this.rankingService.processRankingJob(payload),
      { maxAttempts: 3, baseDelayMs: 2000 },
    );
  }
}
```

`OnModuleInit` মানে — **app চালু হলেই worker নিজে থেকে queue শুনতে বসে যায়**।
কারও ডাকার দরকার নেই। এই ফাইলে কোনো ব্যবসার লজিক নেই, শুধু "কে কোন queue শুনবে"।

### `ranking.controller.ts` — ৯টা route

| Method | Path | ডাকে | Permission | HTTP |
|---|---|---|---|---|
| POST | `/ranking/generate-roll` | `requestGenerate` | `RANKING_GENERATE` | **202** |
| POST | `/ranking/recalculate` | `requestRecalculate` | `RANKING_RECALCULATE` | **202** |
| POST | `/ranking/unlock` | `unlock` | `RANKING_UNLOCK` | 201 |
| GET | `/ranking/:classId/:academicSessionId` | `getRanking` | `RANKING_READ` | 200 |
| GET | `…/history` | `getHistory` | `RANKING_READ` | 200 |
| GET | `…/audit` | `getAuditLog` | `RANKING_READ` | 200 |
| GET | `…/job-status` | `getJobStatus` | `RANKING_READ` | 200 |
| GET | `/ranking/dlq` | `getDeadLetters` | `RANKING_ADMIN` | 200 |
| POST | `/ranking/dlq/replay` | `replayDeadLetters` | `RANKING_ADMIN` | 200 |

> ⚠️ **`@HttpCode(202)` কেন?** ২০১/২০০ মানে "কাজ হয়ে গেছে"। কিন্তু আমরা তো শুধু
> লাইনে দিয়েছি! **202 Accepted** মানে "গ্রহণ করলাম, পরে হবে" — HTTP-এর সঠিক শব্দ।
> ক্লায়েন্ট এটা দেখে বুঝবে তাকে `job-status` poll করতে হবে।

### `ranking.module.ts`
```
imports:   TypeOrmModule.forFeature([RankingHistory, RankingAuditLog, Exam,
                                     ExamResult, StudentEnrollment, Section]),
           RankingLocksModule, AcademicSessionsModule, ClassesModule
controllers: [RankingController]
providers: [RankingService, RankingRepository, RankingEngine, RollEngine,
            RankingQueue, RollQueue, RankingJob, RollJob]
exports:   [RankingService]
```

> ⚠️ **`RankingJob` / `RollJob` provider list-এ থাকতেই হবে।** Nest যদি তাদের
> instantiate না করে, `onModuleInit` কখনো চলবে না, কেউ queue শুনবে না — job
> চিরকাল queue-তে বসে থাকবে আর তুমি ভাববে RabbitMQ কাজ করছে না। **এই ভুলটা
> খুঁজে পাওয়া সবচেয়ে কষ্টের**, কারণ কোনো error আসে না।

শেষে `app.module.ts`-এ `RankingModule`, `RankingLocksModule`, `RabbitMQModule` যোগ করো।

---

# 🔍 Call Trace — কে কাকে ডাকে, একটার পর একটা

## ট্রেস ১ — Admin generate চাপল (HTTP অংশ, ~50ms)

```
 1. HTTP POST /ranking/generate-roll
 2. JwtAuthGuard.canActivate()            → token যাচাই + Redis session বেঁচে আছে?
 3. PermissionsGuard.canActivate()        → RANKING_GENERATE আছে?
 4. ValidationPipe                        → GenerateRollDto (UUID যাচাই)
 5. RankingController.generateRoll(dto, userId)
 6. └─ RankingService.requestGenerate(dto, userId)
 7.    ├─ loadClassAndSession()
 8.    │    ├─ ClassesRepository.findById()            → নেই? throw 404
 9.    │    └─ AcademicSessionsRepository.findById()   → নেই? throw 404
10.    │      return session.admissionTestEnabled
11.    ├─ RankingLocksService.isLocked()
12.    │    └─ RankingLocksRepository.isLocked()       → true? throw 409
13.    ├─ assertExamsReady()
14.    │    ├─ RankingRepository.isExamPublished('FINAL')      → না? throw 400
15.    │    └─ (admissionTestEnabled হলে) isExamPublished('ADMISSION')
16.    └─ enqueue('GENERATE', dto, userId)
17.       ├─ setJobStatus() → RedisService.setEx('ranking:job:…', {status:'queued'}, 86400)
18.       └─ RankingQueue.publish(payload)              [try/catch-এ মোড়া]
19.          └─ RabbitMQService.publish('ranking.jobs', payload)
20.             ├─ pubChannel.assertQueue('ranking.jobs', {durable:true})
21.             ├─ pubChannel.bindQueue('ranking.jobs', 'app.jobs', 'ranking.jobs')
22.             └─ confirmPublish(…, {persistent:true, headers:{'x-attempts':0}})
23.                └─ ⏳ broker confirm আসা পর্যন্ত অপেক্ষা → তবেই resolve
24. ◄── 202 Accepted { status: 'queued' }        🏁 HTTP request এখানেই শেষ

     ❌ publish ব্যর্থ হলে → trySetJobStatus('failed', stage:'enqueue') → throw
        (status 'queued'-এ আটকে থাকে না, ইউজার অনন্তকাল poll করে না)
```

## ট্রেস ২ — Worker ১ জেগে উঠল (background, ~2s)

```
25. RabbitMQ 'ranking.jobs'-এ message দিল
26. subChannel.consume callback (registerConsumer-এর ভেতরে)
27. └─ RabbitMQService.handleMessage('ranking.jobs', msg, handler, 3, 2000, 60000)
28.    ├─ attempts = msg.headers['x-attempts'] → 0
29.    ├─ payload  = JSON.parse(msg.content)     ← ব্যর্থ? → parkInDlq, এখানেই শেষ
30.    └─ await handler(payload)      ← handler = RankingJob-এ দেওয়া arrow function
31.       └─ RankingService.processRankingJob(payload)
32.          ├─ setJobStatus('processing', stage:'ranking') → Redis
33.          ├─ loadClassAndSession()
34.          ├─ isLocked() দ্রুত চেক → locked? status 'completed'+skipped, return
35.          ├─ RankingEngine.buildCombinedRanking(class, session, admEnabled)
36.          │    ├─ RankingRepository.getMeritList()      → VIEW SELECT
37.          │    ├─ RankingRepository.getNewStudents()
38.          │    ├─ admEnabled? getAdmissionScores() + sortAndRank()  ← toTime() তুলনা
39.          │    │  না হলে: oldList + FIFO (sort ছাড়া)
40.          │    └─ return ranked[]
41.          ├─ rankedList = ranked.map(→ ৩টা field)   ← message ছোট রাখে
42.          └─ RollQueue.publish({ ...payload, rankedList })
43.             └─ RabbitMQService.publish('roll.jobs', …)   ← confirm-সহ
44.    └─ safeAck(msg)      ✅ ranking.jobs-এর message শেষ
```

## ট্রেস ৩ — Worker ২ (আসল DB লেখা, ~1s)

```
45. RabbitMQ 'roll.jobs'-এ message দিল
46. └─ handleMessage → handler → RankingService.processRollJob(payload)
47.    ├─ setJobStatus('processing', stage:'roll')
48.    └─ RollEngine.generateRolls({classId, academicSessionId}, rankedList, by, GENERATE)
49.       ├─ RankingRepository.getSectionsForClass()        (TX-এর বাইরে)
50.       └─ dataSource.transaction(manager => {   ═══ BEGIN ═══
51.            ├─ RankingRepository.advisoryLock(manager)   🚪 pg_advisory_xact_lock
52.            ├─ GENERATE → RankingLocksService.isLocked(…, manager)   ⭐ চূড়ান্ত check
53.            │    locked? → return { skipped: true }  (কিছুই লেখা হলো না)
54.            ├─ this.assignRolls(rankedList, sections)
55.            │    └─ effectiveCapacities(sections, ranked.length)
56.            ├─ RankingRepository.getNextVersion(manager) → 3
57.            ├─ প্রতি ছাত্রে loop:
58.            │    ├─ RankingRepository.assignRollAndSection(manager, classId, …) → boolean
59.            │    └─ true হলে RankingRepository.saveHistoryRow(manager)
60.            ├─ RankingLocksService.lock(class, session, by, manager)   🔒
61.            │    └─ RankingLocksRepository.writeLock() → INSERT ON CONFLICT
62.            └─ RankingRepository.logAudit(manager, { action, toVersion: 3 })
63.          })                                    ═══ COMMIT ═══
64.    └─ trySetJobStatus('completed', version:3, studentCount:120) → Redis
65.       (⚠️ এখান থেকে আর throw নয় — কাজ commit হয়ে গেছে)
66. safeAck(msg)      ✅ পুরো কাজ সম্পন্ন
```

## ট্রেস ৪ — ধাপ ৫৮-এ ফেইল করল (retry পথ)

```
58'. assignRollAndSection() throw করল (ধরো DB connection গেল)
     └─ transaction ROLLBACK   ← roll, history, lock, audit — কিছুই বসল না ✅
59'. processRollJob catch:
       ├─ trySetJobStatus('failed', stage:'roll', error) → Redis
       │    (try… কারণ Redis-ও down থাকলে এই লেখাটাই আসল error ঢেকে দিত)
       └─ throw err                      ⚠️ এই throw-টাই retry চালু করে
60'. handleMessage catch:
       ├─ nextAttempts = 0 + 1 = 1        (< 3)
       ├─ computeBackoff(1, 2000, 60000)  → capped 2000 → 1000 + rand(0,1000) → ~1750ms
       ├─ await scheduleRetry('roll.jobs', content, 1, 1750)
       │    ├─ assertQueue('roll.jobs.delay.v2.1750', { x-message-ttl: 1750,
       │    │                x-dead-letter-exchange: 'app.jobs',
       │    │                x-dead-letter-routing-key: 'roll.jobs',
       │    │                x-expires: 601750 })
       │    └─ confirmSendToQueue(delayQueue, content, { 'x-attempts': 1 })
       │       └─ ⏳ broker confirm আসা পর্যন্ত অপেক্ষা
       └─ safeAck(msg)                    ← কপি নিশ্চিত হওয়ার *পরে* মূল message বিদায়

     ❌ কপি পাঠাতেই ব্যর্থ হলে → safeNack(requeue) → job হারায় না

     ⏳ 1750ms পর → TTL শেষ → RabbitMQ নিজেই DLX দিয়ে 'roll.jobs'-এ ফেরত পাঠায়
     ↻ ধাপ ৪৬ থেকে আবার, এবার x-attempts = 1

     আবার ফেইল → attempt 2 → ~3500ms delay → আবার
     আবার ফেইল → nextAttempts = 3 >= maxAttempts
        ├─ parkInDlq → confirmSendToQueue('roll.jobs.dlq', { x-attempts: 3, x-error })
        ├─ safeAck(msg)
        └─ logger.error('Job roll.jobs 3 বার ব্যর্থ → DLQ')      🗑️ পার্ক

     Redis-এ status: 'failed' → ইউজার job-status দেখে বুঝবে
     Admin: GET /ranking/dlq → দেখো (total/truncated সহ) → সমস্যা সারাও
            → POST /ranking/dlq/replay
```

### দুইটা বিশেষ পথ

```
malformed JSON (poison message)
     handleMessage-এ JSON.parse ব্যর্থ → সোজা parkInDlq
     ↑ retry করা হয় না — parse কখনোই সফল হবে না, শুধু ৩ বার সময় নষ্ট হতো

commit হয়ে যাওয়ার পরে Redis down
     ধাপ ৬৪-এ trySetJobStatus warn log দিয়ে চুপ করে যায়
     ↑ throw করলে RabbitMQ পুরো roll job আবার চালাত → version 4 তৈরি হতো
       (একই ডেটার duplicate)। status হারানো তুচ্ছ, কাজ দুইবার হওয়া নয়।
```

## ট্রেস ৫ — Admin ফলাফল দেখল

```
 1. GET /ranking/:classId/:academicSessionId
 2. └─ RankingService.getRanking()
 3.    ├─ loadClassAndSession()
 4.    ├─ getJobStatus()                   → RedisService.get → { status: 'completed', … }
 5.    ├─ RankingRepository.getLatestVersion()   → 3  (null হলে ranking: [] দিয়ে return)
 6.    └─ RankingRepository.getSnapshot(…, 3)    → history ⋈ student ⋈ user
 7. ◄── { version: 3, jobStatus: {...}, ranking: [ {roll_number, rank_position, student_name}, … ] }
```

---

# ✅ ধাপে ধাপে টেস্ট (প্রতিটার পর থামো)

| ধাপ শেষে | কী টেস্ট করবে | কী দেখতে চাও |
|---|---|---|
| ১ (DB) | `SELECT * FROM student_merit_list LIMIT 5;` | rank_position সহ সারি |
| ৩ (RabbitMQ) | app চালাও | log: `RabbitMQ connected`; UI-তে exchange `app.jobs` |
| ৪ (locks) | `GET /ranking-locks/<c>/<s>` | `{ isLocked: false }` |
| ৭ (repo) | সাময়িকভাবে একটা test route থেকে `getMeritList()` ডাকো | সারি আসছে |
| ৮ (engine) | unit test — নকল merit + new student দাও | rank ঠিক ক্রমে, tie-break কাজ করছে |
| ১২ (সব) | `POST /ranking/generate-roll` | **202**; log-এ `Consumer bound: ranking.jobs` |
| ১২ | সাথে সাথে `GET …/job-status` | `queued` → `processing` → `completed` |
| ১২ | `GET /ranking/<c>/<s>` | roll সহ তালিকা, version 1 |
| ১২ | আবার `POST /generate-roll` | **409** (lock হয়ে গেছে) ✅ |
| ১২ | `POST /generate-roll` + `sectionId` পাঠাও | **400** `property sectionId should not exist` |
| ১২ | `POST /recalculate` | 202 → নতুন version 2 (locked অবস্থায়ও চলে) |
| ১২ | `POST /generate-roll` দুইবার দ্রুত | একটাই version বাড়ে; অন্যটির status `completed` + `skipped: already-locked` |
| ১২ | RabbitMQ বন্ধ করে `POST /generate-roll` | 500 + status `failed` (`queued`-এ আটকে থাকবে না) |
| ১২ | DB বন্ধ করে `POST /recalculate` | retry log (`delay.v2.*` queue), শেষে DLQ |
| ১২ | `GET /ranking/dlq` (SUPER_ADMIN token) | `{ ranking: {total, returned, truncated, messages}, roll: {...} }` |
| ১২ | `POST /ranking/dlq/replay` | job আবার চলে, DLQ খালি |

---

# 🧠 ১০টা সিদ্ধান্ত যা মুখস্থ নয়, বুঝে রাখার

| সিদ্ধান্ত | কারণ |
|---|---|
| **২টা queue, ১টা নয়** | STEP 2 ফেইল করলে merit হিসাব (STEP 1) আবার করতে হয় না — `rankedList` payload-এই আছে |
| **Engine ≠ Service ≠ Queue** | engine শুধু গণিত (test করা সহজ), service সমন্বয়, queue শুধু আনা-নেওয়া |
| **catch-এ status লিখে আবার `throw`** | throw ছাড়া RabbitMQ ভাববে সফল → job নিঃশব্দে হারাবে |
| **কিন্তু commit-এর পরে আর `throw` নয়** | কাজ হয়ে যাওয়ার পর status লেখা ব্যর্থ হলে retry করা মানে duplicate version |
| **চূড়ান্ত lock check TX-এর ভেতরে, advisory lock-এর পরে** | বাইরের চেক শুধু optimization — চেক আর লেখা এক lock-এর ভেতরে না আনলে TOCTOU ফাঁক থাকে |
| **lock roll-এর একই TX-এ** | roll বসল কিন্তু lock হলো না — এই অর্ধেক-অবস্থা ঠেকায় |
| **`unlock` + তার audit একই TX-এ** | audit ছাড়া lock খুলে গেলে "কে খুলল" হারিয়ে যায় |
| **repository-এর সব method-এ optional `manager`** | write **ও read** — কল করা কোডকে transaction-এ অংশ নিতে দেয় |
| **date কখনো `!==` দিয়ে তুলনা নয়** | pg থেকে `Date` object আসে; reference তুলনা comparator ভেঙে দেয় |
| **history immutable + version** | পুরোনো তালিকা কখনো মুছি না → "গতবার কী ছিল?" এর উত্তর সবসময় আছে |
| **`x-attempts` header-এ** | RabbitMQ নিজে attempt গোনে না; আমরা message-এর সাথেই গুনতি বইটা পাঠাই |
| **jitter (random অর্ধেক)** | thundering herd — ৫০টা job একসাথে retry করে DB আবার ফেলে দেওয়া ঠেকায় |
| **confirm channel + confirm-এর পরে ack** | কপি broker-এ পৌঁছানোর নিশ্চয়তা ছাড়া মূল message ছাড়লে job হারাতে পারে |
| **publish আর consume আলাদা channel** | AMQP-তে channel error গোটা channel মারে; একসাথে রাখলে publish-এর ভুল সব consumer মেরে দেয় |
| **`channel.on('error'/'close')` লাগবেই** | channel connection থেকে আলাদাভাবে মরে; listener ছাড়া consumer নীরবে বন্ধ, কোনো log নেই |
| **DLQ, delete নয়** | ব্যর্থ job মানুষের চোখে পড়া দরকার; মুছে ফেললে ডেটা চিরতরে যায় |
| **DLQ peek-এ `total`ও ফেরত** | নীরব truncation — ২০০টা আটকে থাকলেও ৫০টা দেখে অ্যাডমিন ভাবত সব দেখেছে |
| **poison message সোজা DLQ-তে** | malformed JSON retry-তে কখনো সফল হবে না |
| **permission নতুন হলে migration + seed দুটোই** | `RANKING_ADMIN` seed-এ ছিল না, তাই SUPER_ADMIN-ও DLQ endpoint-এ 403 পেত |

---

# 📁 শেষ চেহারা (checklist)

```
src/config/rabbitmq.config.ts                     ☐
src/common/rabbitmq/
  ├── rabbitmq.service.ts    (connect, setupChannels, scheduleChannelRebuild,
  │                            publish, registerConsumer, handleMessage,
  │                            computeBackoff, scheduleRetry, parkInDlq,
  │                            safeAck/safeNack, withTempChannel,
  │                            peekDlq, replayDlq)                                  ☐
  └── rabbitmq.module.ts     (@Global)                                              ☐

src/database/migrations/…-RankingAdminPermission.ts  (RANKING_ADMIN)                ☐
src/database/seeds/seed.sql                          (একই permission mirror)        ☐

src/modules/ranking-locks/
  ├── entities/ranking-lock.entity.ts                                               ☐
  ├── ranking-locks.repository.ts   (findByClassAndSession, isLocked(…, mgr?),
  │                                   lock, unlock, writeLock)                      ☐
  ├── ranking-locks.service.ts      (getStatus, isLocked, lock, unlock — সব mgr?)    ☐
  ├── ranking-locks.controller.ts   (GET :classId/:academicSessionId)                ☐
  └── ranking-locks.module.ts       (exports service + repository)                   ☐

src/modules/ranking/
  ├── entities/ranking-history.entity.ts · ranking-audit-log.entity.ts              ☐
  ├── dto/ generate-roll · recalculate · unlock · history-query                     ☐
  ├── ranking.constants.ts   (RANKING_QUEUE, ROLL_QUEUE, RollListEntry,
  │                            payload types — sectionId **নেই**)                    ☐
  ├── ranking.repository.ts  (isExamPublished, getMeritList, getNewStudents,
  │                            getAdmissionScores, getSectionsForClass,
  │                            advisoryLock, assignRollAndSection(+classId),
  │                            getNextVersion, saveHistoryRow, logAudit,
  │                            getLatestVersion, getSnapshot, getVersionList,
  │                            getAuditLog)                                        ☐
  ├── engine/ranking.engine.ts  (toTime, buildCombinedRanking, sortAndRank)         ☐
  ├── engine/roll.engine.ts     (generateRolls, assignRolls,
  │                              effectiveCapacities)                              ☐
  ├── queue/ranking.queue.ts · queue/roll.queue.ts   (publish)                      ☐
  ├── ranking.service.ts     (requestGenerate, requestRecalculate, enqueue,
  │                            processRankingJob, processRollJob, unlock,
  │                            getRanking, getHistory, getAuditLog, getJobStatus,
  │                            getDeadLetters, replayDeadLetters,
  │                            + helpers: jobKey, setJobStatus, trySetJobStatus,
  │                              loadClassAndSession, assertExamsReady)             ☐
  ├── job/ranking.job.ts · job/roll.job.ts   (onModuleInit → registerConsumer)      ☐
  ├── ranking.controller.ts  (৯টা route)                                            ☐
  └── ranking.module.ts      (⚠️ job গুলো providers-এ আছে তো?)                       ☐

app.module.ts  ← RabbitMQModule, RankingLocksModule, RankingModule                  ☐
```

**শেখার নিয়ম:** পুরোনো কোড copy না করে খালি ফাইলে নিজে টাইপ করো। আটকে গেলে তবেই
আসল ফাইল দেখো। প্রতিটা ধাপ শেষে উপরের টেবিল অনুযায়ী টেস্ট করে তবেই এগোও।
