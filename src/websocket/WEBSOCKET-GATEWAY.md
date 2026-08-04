# 🔌 WebSocket (EventsGateway) — কোন function কে ডাকে

> `events.gateway.ts`-এর function-গুলো তোমার নিজের কোডে সরাসরি call করতে দেখা যায় না বলে
> "unused" মনে হয়। আসলে এগুলো **দুই ভিন্ন জাতের** — কেউ framework ডাকে, কেউ client ডাকে,
> কেউ তোমার service ডাকে।

---

## 🧭 এক নজরে — কে কাকে ডাকে

| Function | কে call করে? | তোমার কোডে দেখা যায় না কেন |
|----------|-------------|---------------------------|
| `handleConnection` | **Socket.IO framework** (auto) | তুমি না, framework নিজে ডাকে |
| `handleDisconnect` | **Socket.IO framework** (auto) | ঐ একই |
| `handlePing` | **Client** (browser) `socket.emit('ping')` করলে | trigger বাইরে থেকে আসে |
| `emitToUser` | **তোমার নিজের কোড** (notifications service) | ✅ ব্যবহার হচ্ছে |
| `emitEvent` | কেউ না (এখনো) | future placeholder |

---

## ১. `handleConnection` / `handleDisconnect` — framework lifecycle hook

class ঘোষণাতেই চুক্তি লেখা:

```ts
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect
```

এই `implements`-ই চুক্তি। client connect করলে Socket.IO **নিজে থেকে** `handleConnection(socket)`
ডাকে, disconnect হলে `handleDisconnect(socket)` ডাকে। NestJS-এর `OnModuleInit` lifecycle-এর মতোই —
হাতে call করতে হয় না, নাম দেখেই framework খুঁজে নেয়।

- `handleConnection` → JWT verify + Redis session check → socket-কে `user:<id>` room-এ ঢোকায়।
- `handleDisconnect` → শুধু log লেখে।

## ২. `handlePing` — client-triggered message handler

```ts
@SubscribeMessage('ping')
handlePing(): string { return 'pong'; }
```

`@SubscribeMessage('ping')` মানে — **client** যখন `socket.emit('ping')` পাঠায় তখন এটা চলে,
`'pong'` ফেরত দেয়। trigger আসে **বাইরে থেকে (client)**, তাই server কোডে call নেই।
মূলত connection জ্যান্ত আছে কিনা টেস্ট করার helper।

## ৩. `emitToUser` — এটা আসলেই ব্যবহার হচ্ছে ✅

`notifications.service.ts`:

```ts
this.eventsGateway.emitToUser(n.recipientId, 'notification', n);
```

কারো জন্য notification তৈরি হলে notification service এই gateway-এর `emitToUser` ডেকে
ঐ user-এর `user:<id>` room-এ real-time push করে। এটাই পুরো gateway থাকার **আসল কারণ**।

wiring: `websocket.module.ts` → `EventsGateway` export করে → notifications module inject করে।

## ৪. `emitEvent` — এখন সত্যিই unused

শুধু definition আছে, কোথাও call নেই। এটা সবাইকে broadcast (`server.emit`) করার জন্য —
future-এ "সবার জন্য general announcement/system alert" feature-এর placeholder।
এখন মুছেও দিতে পারো, রেখেও দিতে পারো — কোনো ক্ষতি নেই।

---

## 💡 এক লাইনে মনে রাখো

> `handle*` function-গুলো **framework/client ডাকে** (তাই তোমার কোডে দেখো না),
> `emitToUser` **তোমার notification service ডাকে** (কাজ করছে),
> আর `emitEvent` **এখনো কেউ ডাকে না** (future placeholder)।

---

## 🔗 সম্পর্কিত ফাইল

- `events.gateway.ts` — এই gateway
- `websocket.module.ts` — `EventsGateway` export
- `../modules/notifications/notifications.service.ts` — `emitToUser` consumer
- `../modules/auth/session.util.ts` — `sessionKey()` (Redis session check)
