# Ranking Module

একটা **class + academic session**-এর সব student-কে পরীক্ষার ফলাফল অনুযায়ী
**merit-এ সাজিয়ে (ranking)** প্রত্যেককে **roll + section** বসায়। ভারী কাজটা
**background job**-এ (RabbitMQ) হয় — API সাথে সাথে `202` দেয়, fail করলে নিজে থেকে retry হয়।

---

## দুই ধাপের flow

```
Admin ──POST /generate-roll──▶ controller ──▶ service.requestGenerate()
                                                 │  validation: class/session আছে?
                                                 │  locked? (409)  FINAL exam published? (400)
                                                 ▼  status=queued → publish
                                        [ ranking.jobs ]  ← STEP 1
                                                 ▼
                              service.processRankingJob()
                                RankingEngine.buildCombinedRanking()  → rankedList
                                                 ▼  publish({..., rankedList})
                                        [ roll.jobs ]  ← STEP 2
                                                 ▼
                              service.processRollJob()
                                RollEngine.generateRolls()  [1 transaction]:
                                  advisory lock → roll+section assign
                                  → history save → class LOCK → audit
                                                 ▼  status=completed ✅
Admin ──GET /:classId/:sessionId──▶ jobStatus + সাজানো তালিকা
```

**কেন দুই queue?** STEP 2 (DB লেখা) fail করলে শুধু সেটাই retry হয় — merit হিসাব
(STEP 1) আবার করতে হয় না, কারণ `rankedList` job-এর সাথেই পাঠানো। দায়িত্বও পরিষ্কার:
STEP 1 = হিসাব, STEP 2 = DB।

---

## Retry, DLQ ও status

- worker throw করলে RabbitMQ **exponential backoff**-এ retry করে (2s → 4s → 8s…, cap `RABBITMQ_MAX_DELAY_MS`)।
- **৩ বার** fail করলে job **DLQ** (`*.jobs.dlq`)-তে পার্ক হয় — হারায় না।
- প্রতি ধাপের status **Redis**-এ থাকে (key `ranking:job:<classId>:<sessionId>`):
  `queued → processing (ranking) → processing (roll) → completed | failed`।

RabbitMQ-তে দেখা যাবে: `ranking.jobs` / `roll.jobs` (+ `.dlq` + `.delay.*`)।

---

## GENERATE vs RECALCULATE

| | GENERATE | RECALCULATE |
|--|--|--|
| endpoint | `POST /generate-roll` | `POST /recalculate` |
| locked থাকলে | থামে (**409**) | আগে **unlock** করে চালায় |
| worker safety | locked পেলে skip | সরাসরি চালায় |

আলাদা `unlock` শুধু lock খোলে (audit log সহ), নতুন কিছু generate করে না।

---

## Endpoints

| Method | Path | কাজ | Permission |
|--|--|--|--|
| POST | `/ranking/generate-roll` | ranking + roll (queue, 202) | `RANKING_GENERATE` |
| POST | `/ranking/recalculate` | unlock করে আবার generate (202) | `RANKING_RECALCULATE` |
| POST | `/ranking/unlock` | শুধু lock খোলে | `RANKING_UNLOCK` |
| GET | `/ranking/:classId/:sessionId` | সর্বশেষ ranking + jobStatus | `RANKING_READ` |
| GET | `/ranking/:classId/:sessionId/history` | version list / snapshot | `RANKING_READ` |
| GET | `/ranking/:classId/:sessionId/audit` | audit log | `RANKING_READ` |
| GET | `/ranking/:classId/:sessionId/job-status` | সর্বশেষ job status | `RANKING_READ` |
| GET | `/ranking/dlq` | DLQ-তে পার্ক হওয়া ব্যর্থ job (peek) | `RANKING_ADMIN` |
| POST | `/ranking/dlq/replay` | DLQ → main queue-তে ফেরত (attempts reset) | `RANKING_ADMIN` |

---

## ফাইল দায়িত্ব

```
ranking.controller.ts   HTTP endpoint
ranking.service.ts      ম্যানেজার — validation, queue, status, read, DLQ admin
ranking.repository.ts   raw SQL
ranking.constants.ts    queue নাম + job payload type
engine/ranking.engine   merit → rankedList (OLD merit + NEW FIFO/admission, tie-break)
engine/roll.engine      1 transaction-এ roll+section + history + lock + audit
queue/*.queue.ts        producer — job পাঠায়
job/*.job.ts            worker — job শোনে ও চালায়
entities/               ranking_history, ranking_audit_log
```

**পড়া শুরু করুন:** controller → service (`requestGenerate → processRankingJob →
processRollJob`) → engine → শেষে queue/job (ছোট ফাইল, শুধু পাঠানো/শোনা)।
