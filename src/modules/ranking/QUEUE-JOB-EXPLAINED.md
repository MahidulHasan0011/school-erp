# Queue, Job, RabbitMQ — একদম সহজ ভাষায় (বাংলা)

> এই ডকুমেন্টটা `ranking` + `ranking-locks` মডিউলের background job সিস্টেম
> ব্যাখ্যা করে — রেস্টুরেন্টের উদাহরণ দিয়ে, শূন্য থেকে।
>
> সম্পর্কিত কোড:
> - `src/modules/ranking/` — controller, service, queue/, job/, engine/
> - `src/modules/ranking-locks/` — lock টেবিল ও service
> - `src/common/rabbitmq/rabbitmq.service.ts` — RabbitMQ wrapper (retry + DLQ)
> - `src/config/rabbitmq.config.ts` — prefetch, maxDelayMs ইত্যাদি

---

## ১. প্রথমে গল্পটা: একটা রেস্টুরেন্ট 🍽️

ধরো তুমি একটা রেস্টুরেন্টে গেলে।

| রেস্টুরেন্ট | আমাদের কোড |
|---|---|
| **ওয়েটার** — অর্ডার নেয়, রান্না করে না | `ranking.controller.ts` (API endpoint) |
| **অর্ডার স্লিপ** (কাগজের টুকরো) | **Job / Message** (payload) |
| **রান্নাঘরের স্লিপ-হোল্ডার** (স্লিপ ঝুলে থাকে লাইন ধরে) | **Queue** — RabbitMQ |
| **রাঁধুনি** — স্লিপ নিয়ে রান্না করে | **Worker / Consumer** = `job/ranking.job.ts`, `job/roll.job.ts` |
| **রেসিপি বই** — কীভাবে রাঁধবে | **Engine** = `engine/ranking.engine.ts`, `engine/roll.engine.ts` |
| **"অর্ডার রেডি?" বোর্ড** | **Redis** job-status |
| **নষ্ট হওয়া অর্ডারের ঝুড়ি** | **DLQ** (Dead Letter Queue) |
| **টেবিলে "Reserved" সাইন** | **`ranking_locks`** টেবিল |

**সবচেয়ে বড় আইডিয়া:** ওয়েটার তোমার সামনে দাঁড়িয়ে রান্না শেষ হওয়া পর্যন্ত অপেক্ষা
করে না। সে স্লিপ রান্নাঘরে ঝুলিয়ে দিয়ে বলে — *"অর্ডার নেওয়া হয়েছে, রেডি হলে
জানাবো"*। এটাই **Queue + Job** এর পুরো ব্যাপার।

কারণ ১০০০ ছাত্রের rank হিসাব করতে ৩০ সেকেন্ড লাগতে পারে। HTTP request ৩০ সেকেন্ড
ঝুলে থাকলে browser timeout খেয়ে মরে যাবে। তাই আমরা **202 Accepted** ফেরত দিই —
মানে "কাজটা লাইনে দিলাম"।

---

## ২. RabbitMQ আসলে কী?

RabbitMQ হলো একটা আলাদা সফটওয়্যার (আলাদা সার্ভার), যার একমাত্র কাজ —
**চিঠি জমা রাখা আর বিলি করা**। মানে ডাকঘর 📮।

তিনটা শব্দ মনে রাখো:

```
Producer (চিঠি লেখে) → Exchange (সর্টিং টেবিল) → Queue (চিঠির বাক্স) → Consumer (চিঠি পড়ে)
```

আমাদের কোডে:

| ভূমিকা | কী / কোথায় |
|---|---|
| Producer | **ফাইল** — `queue/ranking.queue.ts`, `queue/roll.queue.ts` (শুধু `publish()`) |
| Exchange | **নাম** — `'app.jobs'`, constant হিসেবে `rabbitmq.service.ts`-এ (direct exchange) |
| Queue | **নাম** — `'ranking.jobs'`, `'roll.jobs'`, constant হিসেবে `ranking.constants.ts`-এ |
| Consumer | **ফাইল** — `job/ranking.job.ts`, `job/roll.job.ts` (`onModuleInit()`-এ bind হয়) |

> ⚠️ **`app.jobs` কোনো ফাইল নয় — এটা শুধু একটা নাম (string)।** প্রজেক্টে এই নামের
> কোনো ফাইল বা ফোল্ডার নেই, থাকার কথাও নয়। এটা আছে মাত্র এক লাইনে
> ([rabbitmq.service.ts:44](../../common/rabbitmq/rabbitmq.service.ts#L44)):
>
> ```ts
> const EXCHANGE = 'app.jobs';
> ```
>
> আর এই লাইনটা RabbitMQ **সার্ভারের ভেতরে** ওই নামের exchange তৈরি করে:
>
> ```ts
> await this.pubChannel.assertExchange(EXCHANGE, 'direct', { durable: true });
> //     ↑ "এই নামের exchange না থাকলে বানাও, থাকলে ছেড়ে দাও"
> ```
>
> **`ranking.jobs` / `roll.jobs`-ও ঠিক তেমনি নাম** — ফাইল নয়। এগুলো
> `ranking.constants.ts`-এ শুধু দুইটা string।
>
> মিলিয়ে দেখতে চাইলে: app চালাও, তারপর http://localhost:15672 (RabbitMQ
> management UI, login `guest`/`guest`) → **Exchanges** ট্যাবে `app.jobs`,
> **Queues** ট্যাবে `ranking.jobs` ও `roll.jobs` দেখতে পাবে। ওগুলো **ডাকঘরের ভেতরের
> তাক** — তোমার কোডবেসের ফাইল নয়। ডাকঘরটা ডিস্কে নিজের ডেটা রাখে, তোমার প্রজেক্টে নয়।

**Channel তিন ভাগে আলাদা** — কারণ AMQP-তে একটা channel error গোটা channel বন্ধ করে দেয়:

| Channel | কাজ |
|---|---|
| `pubChannel` (confirm) | সব publish — broker নিশ্চিত করার পরই resolve হয় |
| `subChannel` | শুধু consume + ack/nack |
| temp channel (প্রতি কলে নতুন) | DLQ peek/replay — error হলে শুধু ওই কাজটাই ফেলে দেয় |

একই channel-এ publish আর consume রাখলে publish-এর একটা ভুল সব consumer-কে
**নীরবে** মেরে ফেলত। তাই প্রতিটা channel-এ `error` ও `close` listener আছে —
channel connection থেকে আলাদাভাবে মরতে পারে, তখন connection বেঁচে থাকায়
connection-এর `close` handler কখনো চলে না।

কেন ডাকঘর লাগে? কারণ **সার্ভার রিস্টার্ট হলেও চিঠি হারায় না**।
`durable: true` (queue ডিস্কে থাকে) + `persistent: true` (message ডিস্কে থাকে)।
রান্নাঘরে আগুন লাগলেও স্লিপগুলো টিকে থাকে 🙂

---

## ৩. পুরো ডেটা-ফ্লো: ধাপে ধাপে

ধরো হেডস্যার বললেন — *"ক্লাস ৬, ২০২৬ সেশনের রোল নাম্বার বসাও।"*

### ধাপ ০ — অর্ডার দেওয়া

```http
POST /ranking/generate-roll
{ "classId": "ক্লাস-৬", "academicSessionId": "২০২৬" }
```

> ranking সবসময় **পুরো class + session**-এর উপর চলে — `sectionId` পাঠানোর সুযোগ নেই।
> section হলো ফলাফল (capacity অনুযায়ী বিতরণ), ইনপুট নয়।

### ধাপ ১ — ওয়েটার যাচাই করে (`RankingService.requestGenerate`)

queue-তে পাঠানোর *আগেই* চারটা প্রশ্ন:

1. **ক্লাস আর সেশন আছে তো?** না থাকলে → `404`
   *(মেনুতে এই খাবারই নেই)*
2. **এই ক্লাস কি lock করা?** → `409 Conflict`
   *(টেবিলে "Reserved" সাইন — recalculate ছাড়া ছোঁয়া যাবে না)*
3. **FINAL পরীক্ষা PUBLISHED?** না হলে → `400`
   *(মাছ এখনো বাজার থেকে আসেনি, রান্না কীভাবে হবে?)*
4. admission test চালু থাকলে **ADMISSION** পরীক্ষাও PUBLISHED হতে হবে

> 👉 **গুরুত্বপূর্ণ শিক্ষা:** যা এখনই চেক করা যায়, তা queue-তে পাঠানোর আগেই চেক করো।
> কারণ queue-তে পাঠানোর পর ইউজার আর error দেখতে পাবে না — সে তো `202` পেয়ে চলে গেছে।

### ধাপ ২ — স্লিপ লেখা আর বোর্ডে টাঙানো (`RankingService.enqueue`)

```
Redis-এ লেখা হয়:   ranking:job:ক্লাস-৬:২০২৬  =  { status: "queued" }
                                                        ↑ "অর্ডার নেওয়া হয়েছে" বোর্ড
RabbitMQ-তে পাঠানো:  ranking.jobs ← { action, classId, academicSessionId, triggeredBy }
```

ইউজারকে সাথে সাথে ফেরত:

```json
{ "status": "queued", "message": "Ranking job queued — GET দিয়ে ফলাফল দেখুন" }
```

**Redis কেন?** ইউজার জানতে চাইবে "আমার কাজ কতদূর?"। RabbitMQ-কে এই প্রশ্ন করা যায়
না — সে শুধু চিঠি বিলি করে, হিসাব রাখে না। তাই আলাদা একটা ছোট বোর্ডে (Redis)
স্টেটাস লিখে রাখি, ২৪ ঘণ্টার জন্য (`86400` সেকেন্ড TTL)।

### ধাপ ৩ — রাঁধুনি ১: হিসাব করা 👨‍🍳 (`processRankingJob`)

`ranking.jobs` queue-তে চিঠি পড়ল → RabbitMQ সাথে সাথে `RankingJob`-কে ডাকল:

```
Redis → status: "processing", stage: "ranking"

সেফটি re-check: GENERATE হলে আবার lock দেখা
   (queue-তে বসে থাকার মাঝে অন্য কেউ lock করে ফেলতে পারে → skip)

RankingEngine.buildCombinedRanking():
  ├─ পুরোনো ছাত্রদের merit list আনো (database VIEW `student_merit_list`)
  ├─ নতুন ভর্তি ছাত্রদের আনো
  └─ দুই দল মেলাও:
       • admission test নেই  → পুরোনোরা আগে, নতুনরা ভর্তির লাইন ধরে পরে (FIFO, score 0)
       • admission test আছে   → সবাইকে একসাথে নম্বর দিয়ে sort + re-rank

ফলাফল: rankedList = [ {studentId, rankPosition: 1}, {studentId, rankPosition: 2}, ... ]
```

তারপর — এবং এটাই মজার — সে ফলাফল **ডাটাবেসে লেখে না**। সে আরেকটা স্লিপ লিখে
দ্বিতীয় queue-তে ঝুলিয়ে দেয়:

```
roll.jobs ← { ...আগের সব, rankedList: [...] }
```

**কেন দুই ভাগ?** রান্নাঘরে যেমন — একজন সবজি কাটে, আরেকজন রাঁধে। কাটার কাজে ভুল
হলে শুধু কাটাটাই আবার করবে, রান্নাটা না। এখানে:

- **হিসাব** (পড়া-only, ভারী) — ব্যর্থ হলে নিরাপদে যতবার চাই আবার করা যায়
- **লেখা** (transaction, ঝুঁকিপূর্ণ) — আলাদা রাখলে হিসাবের ভুলে ডাটাবেস নোংরা হয় না

### ধাপ ৪ — রাঁধুনি ২: রোল বসানো (`RollEngine.generateRolls`)

এই ধাপটা পুরোটা **একটা DB transaction**-এর ভেতরে — "সব হবে, নয়তো কিছুই হবে না":

```
BEGIN TRANSACTION
  ১. pg_advisory_xact_lock(...)     ← রান্নাঘরের দরজা বন্ধ! দুইজন একসাথে ঢুকতে পারবে না
  ১ক. GENERATE হলে lock আবার দেখো   ← locked পেলে কিছু না লিখে বেরিয়ে যাও
       (দুইবার ক্লিকে দুইটা version তৈরি হওয়া আটকায় — নিচে দেখো)
  ২. rank অনুযায়ী roll বসাও:
       • ০/১ section → roll = rankPosition (১, ২, ৩...)
       • অনেক section → capacity ভরে ভরে, প্রতি section-এ আবার ১ থেকে
                        (শেষ section overflow শোষণ করে;
                         max_capacity NULL হলে বাকিদের সমান ভাগ পায়)
  ৩. version নাও (v1, v2, v3...)   ← পুরোনো হিসাব মুছি না, নতুন version বানাই
  ৪. প্রতি ছাত্রের enrollment-এ roll_number + section_id লেখো
       (update না হলে — যেমন withdrawn — সে snapshot-এ যাবে না)
  ৫. ranking_history-তে snapshot রাখো (এই version-এর ছবি)
  ৬. ranking_locks → isLocked = true   ← টেবিলে "Reserved" সাইন 🔒
  ৭. audit log লেখো (কে, কখন, কী করল)
COMMIT
```

মাঝপথে কারেন্ট গেলে? `COMMIT` হয়নি → Postgres সব ফেলে দেবে। অর্ধেক ছাত্রের roll
বসে গেছে, বাকিদের হয়নি — এমন হবে না। **এটাই atomicity।**

শেষে Redis → `status: "completed", version: 3, studentCount: 120` ✅

---

## ৪. `advisoryLock` বনাম `ranking_locks` — দুইটা ভিন্ন তালা 🔐

এখানে নতুনরা সবসময় গুলিয়ে ফেলে। দুটো একদম আলাদা জিনিস:

| | **advisoryLock** (`pg_advisory_xact_lock`) | **`ranking_locks`** টেবিল |
|---|---|---|
| উদাহরণ | **টয়লেটের দরজার ছিটকিনি** 🚪 | **"Reserved" সাইন** টেবিলে 🪧 |
| আয়ু | কয়েক সেকেন্ড — transaction শেষে নিজেই খুলে যায় | মাস ধরে থাকে, মানুষ হাতে খোলে |
| কে জানে | শুধু ডাটাবেস | সব ইউজার, API-তে দেখা যায় |
| কাজ | দুইটা worker একসাথে একই ক্লাস লিখতে গেলে একজন **অপেক্ষা** করবে | ভুল করে দুইবার rank বসানো **আটকায়** |
| ফেইল করলে | কেউ ফেইল করে না, শুধু লাইনে দাঁড়ায় | `409 Conflict` error |

`advisoryLock` **টেকনিক্যাল** (race condition ঠেকায়),
`ranking_locks` **বিজনেস নিয়ম** (রোল একবার বসলে আর বদলায় না)।

দুইটা একসাথে কাজ করে: ছিটকিনি ধরে রেখে "Reserved" সাইনটা **পড়া** হয় — এই কারণেই
দুইবার ক্লিক করলে দ্বিতীয় job লাইনে দাঁড়িয়ে ঢুকে দেখে সাইন বসে গেছে, আর কিছু না
লিখে বেরিয়ে যায়। ছিটকিনি ছাড়া পড়লে দুজনেই "খোলা আছে" দেখত।

**Recalculate** কী করে? "Reserved" সাইন **সরায় না** — locked অবস্থার উপরেই চলে,
আর কাজ শেষে সাইনটা নতুন করে বসায়। আগে আগাম unlock করা হতো, কিন্তু queue-তে পাঠানো
ব্যর্থ হলে ক্লাস খোলা অবস্থায় পুরনো roll নিয়ে পড়ে থাকত।

---

## ৫. ফেইল হলে কী হয়? Retry + Backoff

ধরো রাঁধুনি রান্না করতে গিয়ে দেখল গ্যাস নেই। সে কী করবে?

- **বোকা রাঁধুনি:** সাথে সাথেই আবার চেষ্টা, আবার, আবার... সেকেন্ডে ১০০০ বার।
  গ্যাস তো আসেনি! শুধু নিজেকে আর সবাইকে জ্বালাল।
- **বুদ্ধিমান রাঁধুনি:** ২ সেকেন্ড অপেক্ষা → চেষ্টা → ৪ সেকেন্ড → চেষ্টা →
  ৮ সেকেন্ড → চেষ্টা → এখনো না হলে **স্লিপটা "সমস্যা" ঝুড়িতে রেখে দাও**,
  ম্যানেজার এসে দেখবে।

আমাদের কোড বুদ্ধিমান রাঁধুনি (`RabbitMQService.handleMessage`):

```
message এল
  │
  ├─ JSON.parse ব্যর্থ?  → সরাসরি DLQ (poison message — retry-তে কখনো সফল হবে না)
  │
  └─ handler() throw করল
       │
       ├─ attempt < maxAttempts (3)?  → delay হিসাব → delay queue-তে রাখো
       │                                → confirm এল → তবেই মূল message ack
       │
       └─ attempt = maxAttempts?      → `<queue>.dlq`-তে পার্ক + x-attempts, x-error
                                        → confirm এল → তবেই ack
```

> ⚠️ **ক্রমটা খেয়াল করো:** retry/DLQ কপি broker-এ পৌঁছেছে — এই **নিশ্চিত হওয়ার পরেই**
> মূল message ছাড়া হয়। কপি পাঠাতে ব্যর্থ হলে ack করা হয় না, message queue-তে ফিরে
> যায়। আগে confirm ছাড়াই ack হতো, তাই মাঝপথে connection মরলে job একেবারে হারাতে পারত।

### Delay queue-এর ট্রিক (খুব চালাক জিনিস)

RabbitMQ-তে "৪ সেকেন্ড পরে দিও" বলার সোজা উপায় নেই (plugin ছাড়া)। তাই একটা
ঠকবাজি করি (`scheduleRetry`):

```
একটা অস্থায়ী queue বানাই:  ranking.jobs.delay.v2.4000
   x-message-ttl: 4000                ← "এই বাক্সে চিঠি ৪ সেকেন্ডে পচে যাবে"
   x-dead-letter-exchange: app.jobs   ← "পচে গেলে..."
   x-dead-letter-routing-key: ranking.jobs   ← "...মূল queue-তে পাঠিয়ে দাও"
   x-expires: 604000                  ← "অনেকক্ষণ অব্যবহৃত থাকলে বাক্সটাই মুছে যাবে"
```

`x-expires` না থাকলে delay queue গুলো চিরকাল পড়ে থাকত। TTL-এর চেয়ে অনেক বেশি সময়
দেওয়া হয়েছে, তাই ভেতরের চিঠি কখনো সময়ের আগে হারায় না।

> নামে `v2` কেন? পুরনো `*.delay.*` queue গুলো `x-expires` ছাড়া declare করা ছিল।
> একই নামে ভিন্ন argument দিয়ে assert করলে RabbitMQ `PRECONDITION_FAILED` দিয়ে
> channel মেরে দিত। নতুন নাম দিলে সেই সংঘাত হয় না — পুরনো (খালি) queue গুলো
> management UI থেকে হাতে মুছে ফেলা যায়।

মানে: **চিঠিটা টাইমার-লাগানো বাক্সে রাখি, ৪ সেকেন্ড পর সে নিজে থেকেই মূল queue-তে
ফেরত চলে আসে।** 🎩✨

### "Equal Jitter" — কেন random? (`computeBackoff`)

```
capped = min(maxDelayMs, baseDelayMs × 2^(attempt-1))
delay  = capped/2  +  random(0, capped/2)
         ↑ নিশ্চিত অর্ধেক    ↑ random অর্ধেক
তারপর 250ms bucket-এ round (delay queue সংখ্যা bound রাখতে)
```

ভাবো — ডাটাবেস ১ মিনিট ডাউন ছিল, ৫০টা job একসাথে ফেইল করল। সবাই যদি ঠিক ৪ সেকেন্ড
পরে একসাথে retry করে, ডাটাবেস আবার হুড়মুড় খেয়ে পড়বে। এটাকে বলে
**thundering herd** — স্কুলের ঘণ্টা পড়লে সব ছেলে একসাথে গেটে ভিড় করার মতো 🏃‍♂️🏃‍♀️🏃

random অংশটা সবাইকে ছড়িয়ে দেয় — কেউ ২.১s, কেউ ৩.৮s, কেউ ২.৯s। ভিড় নেই।
আর অর্ধেকটা fixed রাখি যাতে random খুব ছোট এসে গেলেও delay শূন্যের কাছে না নামে।

---

## ৬. DLQ — "সমস্যা" ঝুড়ি 🗑️

৩ বার ফেইলের পর job মরে যায় না, `ranking.jobs.dlq` / `roll.jobs.dlq`-তে **পার্ক**
হয়ে বসে থাকে। সাথে থাকে `x-attempts` আর `x-error` — কী ভুল হয়েছিল তার নোট।

অ্যাডমিন দুইটা কাজ করতে পারে:

| API | কাজ | উদাহরণ |
|---|---|---|
| `GET /ranking/dlq` | **উঁকি মারা** — কী কী আটকে আছে দেখা | ঝুড়ি থেকে স্লিপ তুলে পড়ে **আবার ঝুড়িতে রেখে দেওয়া** |
| `POST /ranking/dlq/replay` | **আবার চেষ্টা** — মূল queue-তে ফেরত, attempts আবার ০ | সমস্যা সারানোর পর "এবার রাঁধো" বলা |

দুটোই `RANKING_ADMIN` permission চায় (SUPER_ADMIN পায়)।

- `peekDlq` কীভাবে "উঁকি" মারে? সব message `get` করে পড়ে, তারপর
  `nack(msg, false, true)` দিয়ে **requeue** করে ফেরত দেয়। তাই দেখলেও কিছু হারায় না
  (non-destructive)।
- ফলাফলে `returned` (এবার কতটা দেখানো হলো), `total` (DLQ-তে মোট কতটা) আর
  `truncated` থাকে — limit-এ কাটা পড়লে অ্যাডমিন যেন বুঝতে পারে আরও বাকি আছে।
  আগে শুধু ৫০টা ফেরত দিত, তাই ২০০টা আটকে থাকলেও মনে হতো ৫০টাই।
- `replayDlq`-এ উল্টো অর্ডার: আগে মূল queue-তে `publish`, **তারপর** DLQ থেকে `ack`
  (মুছে ফেলা)। এই অর্ডারটা ইচ্ছাকৃত — প্রথমে নতুন কপি বানাও, তারপর পুরোনোটা ফেলো।
  উল্টো করলে মাঝপথে ক্র্যাশ হলে job একেবারে হারিয়ে যেত।

---

## ৭. `prefetch` — একজন রাঁধুনি কয়টা স্লিপ হাতে নেবে?

```
prefetch: 5      ← config/rabbitmq.config.ts (RABBITMQ_PREFETCH)
```

মানে একজন consumer একসাথে সর্বোচ্চ ৫টা unacked message হাতে রাখবে। শেষ না করলে
৬ নম্বর দেবে না।

কেন দরকার? এক রাঁধুনি ৫০টা স্লিপ হাতে নিয়ে নিলে বাকি রাঁধুনিরা খালি হাতে বসে
থাকবে। ৫ করে দিলে কাজ সমান ভাগ হয় — **ধীর কর্মীও অলস বসে থাকে না**।

---

## ৮. Reconnect — লাইন কেটে গেলে?

`RabbitMQService` connection `close` হলে ৫ সেকেন্ড পর আবার `connect()` করে, এবং
`registrations` অ্যারেতে জমা রাখা সব consumer setup আবার চালায়। মানে
**reconnect-এর পরেও রাঁধুনিরা আপনা-আপনি কাজে ফিরে আসে** — কারও হাতে ধরে
আবার bind করাতে হয় না।

**channel মরলেও একই ব্যবস্থা।** প্রতিটা channel-এ `error` ও `close` listener আছে,
যেগুলো channel আবার তৈরি করে সব consumer পুনরায় bind করে। এটা না থাকলে সবচেয়ে
বিপজ্জনক পরিস্থিতি তৈরি হতো — channel connection থেকে **আলাদাভাবে** মরতে পারে
(যেমন `PRECONDITION_FAILED`), তখন connection বেঁচে থাকায় connection-এর `close`
handler কখনো চলত না, আর সব consumer **কোনো error log ছাড়াই** চুপচাপ মরে যেত।
Job জমতে থাকত, কেউ বুঝত না কেন কিছু হচ্ছে না।

আর `ack` করার আগে দেখা হয় channel এখনো সেই একই channel কিনা। দীর্ঘ কাজ চলার মাঝে
reconnect হলে পুরনো channel-এ ack করা throw করত; এখন ack বাদ দেওয়া হয় আর broker
message আবার পাঠায় — কাজ হারায় না।

---

## ৯. পুরো ছবিটা একনজরে

```
হেডস্যার
   │  POST /ranking/generate-roll
   ▼
┌─────────────────┐
│ Controller      │  JwtAuthGuard ✓  PermissionsGuard ✓
└────────┬────────┘
         ▼
┌─────────────────────────────────────────────┐
│ RankingService.requestGenerate()            │
│  class/session ✓  lock ✓  exam PUBLISHED ✓  │
└────────┬────────────────────────────────────┘
         │
         ├──► Redis: status = "queued"
         │
         └──► RabbitMQ  ──►  [ ranking.jobs ]
                                   │
    ◄── 202 Accepted (ইউজার মুক্ত!)  │
                                   ▼
                      ┌──────────────────────────┐
                      │ RankingJob (worker ১)    │
                      │  RankingEngine → হিসাব   │  ← ব্যর্থ? ২s/৪s retry → DLQ
                      └────────────┬─────────────┘
                                   │ rankedList সহ
                                   ▼
                            [ roll.jobs ]
                                   │
                                   ▼
                      ┌──────────────────────────┐
                      │ RollJob (worker ২)       │
                      │  RollEngine → এক TX-এ:   │
                      │   advisory lock 🚪        │
                      │   lock re-check (GENERATE)│
                      │   roll + section         │
                      │   history snapshot (v3)  │
                      │   ranking_locks = 🔒     │
                      │   audit log              │
                      └────────────┬─────────────┘
                                   ▼
                        Redis: status = "completed"
                                   │
হেডস্যার ◄── GET /ranking/:classId/:academicSessionId  (roll list + version)
```

---

## ১০. এক লাইনে মনে রাখার মতো কথা

- **Queue** = লাইন। ইউজারকে অপেক্ষা করাতে হয় না।
- **Job** = লাইনে দাঁড়ানো একটা কাজের স্লিপ।
- **RabbitMQ** = লাইন সামলানো ডাকঘর; রিস্টার্টেও চিঠি বাঁচে।
- **Producer** স্লিপ লেখে, **Consumer** কাজ করে — দুইজন একে অন্যকে চেনে না।
- **Redis** = "কতদূর হলো?" জানার বোর্ড।
- **Retry + backoff + jitter** = ভদ্রভাবে আবার চেষ্টা, একসাথে হুড়োহুড়ি নয়।
- **DLQ** = হার মানা নয়, বরং "মানুষ এসে দেখবে" ঝুড়িতে রাখা।
- **advisoryLock** = কয়েক সেকেন্ডের টেকনিক্যাল ছিটকিনি।
- **`ranking_locks`** = মাসজুড়ে থাকা বিজনেস "Reserved" সাইন।
- **Transaction** = সব হবে নয়তো কিছুই না।
- **Engine** = শুধু হিসাব (রেসিপি), **Job/Queue** = শুধু আনা-নেওয়া (ওয়েটার)।
  এই ভাগটাই কোডটাকে পরিষ্কার রাখে।

---

## ১১. কোন ফাইলে কী আছে (quick map)

```
src/modules/ranking/
├── ranking.controller.ts      ওয়েটার — API endpoint, guard, 202 Accepted
├── ranking.service.ts         orchestration — validate, enqueue, processJob, read, DLQ
├── ranking.repository.ts      SQL — merit view, advisory lock, roll write, history, audit
├── ranking.constants.ts       queue নাম + payload টাইপ
├── queue/
│   ├── ranking.queue.ts       Producer — ranking.jobs -তে publish
│   └── roll.queue.ts          Producer — roll.jobs -তে publish
├── job/
│   ├── ranking.job.ts         Consumer ১ — onModuleInit-এ bind, maxAttempts 3
│   └── roll.job.ts            Consumer ২ — একই, roll.jobs -এর জন্য
├── engine/
│   ├── ranking.engine.ts      রেসিপি — merit + new student merge, sort, rank
│   └── roll.engine.ts         রেসিপি — roll/section assign + এক TX-এ সব commit
└── entities/                  ranking_history, ranking_audit_log

src/modules/ranking-locks/
├── ranking-locks.service.ts   isLocked / lock / unlock / getStatus
├── ranking-locks.repository.ts
└── entities/ranking-lock.entity.ts   ranking_locks টেবিল (class+session UNIQUE)

src/common/rabbitmq/rabbitmq.service.ts   publish, registerConsumer,
                                          retry+backoff, delay queue, peekDlq, replayDlq
src/config/rabbitmq.config.ts             url, prefetch, maxDelayMs
```
