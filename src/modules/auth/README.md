# 🔐 Auth Module — কীভাবে কাজ করে

> Login / logout / token refresh + প্রতিটা protected route-এর "দারোয়ান"।
> এই module নিজে কোনো DB table রাখে না — user আসে `UsersModule` থেকে,
> session থাকে **Redis**-এ, আর token হলো **stateless JWT**।

---

## 📁 ফাইলগুলোর দায়িত্ব

| ফাইল | কাজ |
|------|-----|
| `auth.controller.ts` | HTTP endpoint: `login`, `refresh`, `logout`, `me` |
| `auth.service.ts` | আসল logic: credential যাচাই, token বানানো, session store/delete |
| `strategies/jwt.strategy.ts` | প্রতিটা request-এ token verify + Redis session check → `req.user` বানায় |
| `session.util.ts` | ছোট helper: `sessionKey(sid)` + duration → সেকেন্ড |
| `auth.repository.ts` | **খালি placeholder** — এখন dorকার নেই (session Redis-এ, token stateless)। পরে DB-তে refresh-token/password-reset রাখতে চাইলে এখানে বসবে |
| `auth.module.ts` | JwtModule + PassportModule + UsersModule wire করে |

---

## 🧠 ৩টি মূল ধারণা

1. **JWT (stateless):** token-এর ভেতরেই user id, email, roles, permissions, `sid` লেখা থাকে। signature verify করলেই চলে — প্রতি request-এ DB query লাগে না।
2. **Session (Redis):** প্রতিটা login একটা `sid` (random UUID) বানায়, আর Redis-এ `session:<sid>` key রাখে। **logout = এই key মুছে ফেলা।** তাই token মেয়াদ না ফুরালেও logout-এর পর সেটা অকেজো হয়ে যায় (revocation)।
3. **Access vs Refresh token:**
   - **access** — short-lived (`1d`), roles+permissions সহ, প্রতি request-এ পাঠাও।
   - **refresh** — long-lived (`7d`), শুধু identity+`sid`, নতুন access token নিতে ব্যবহার হয়।

---

## 🔄 Flow ১ — Login

```
POST /auth/login  { email, password }
        │
        ▼
AuthController.login()
        │
        ▼
AuthService.login()
   ├─ UsersService.validateCredentials(email, password)   ← bcrypt.compare
   │      └─ ভুল হলে → 401 Unauthorized
   ├─ sid = randomUUID()                                   ← নতুন session
   └─ buildTokens(user, sid)
          ├─ UsersService.getAccessControl(userId)         ← roles + permissions লোড
          ├─ redis.setEx(session:<sid>, userId, TTL=7d)    ← Redis-এ session
          ├─ accessToken  = sign({ sub, email, roles, permissions, sid })
          └─ refreshToken = sign({ sub, email, sid })
        │
        ▼
{ accessToken, refreshToken, user }
```

---

## 🔄 Flow ২ — Protected route (যেমন `GET /auth/me`)

```
GET /auth/me   Header: Authorization: Bearer <accessToken>
        │
        ▼
@UseGuards(JwtAuthGuard)
        │
        ▼
JwtAuthGuard  →  AuthGuard('jwt')  →  JwtStrategy
        ├─ 1. header থেকে token বের করে
        ├─ 2. jwt.secret দিয়ে signature + exp verify
        └─ 3. validate(payload):
                └─ payload.sid থাকলে → redis.exists(session:<sid>)?
                       ├─ নেই (logout হয়ে গেছে) → 401
                       └─ আছে → req.user = { id, email, roles, permissions, sid }
        │
        ▼
@CurrentUser('id') → req.user.id  →  controller handler চলে
```

> মনে রাখো: **`JwtAuthGuard` খালি** (`extends AuthGuard('jwt')`) — আসল verify কাজটা `JwtStrategy`-তে হয়। এটাই Passport-এর design।

---

## 🔄 Flow ৩ — Refresh (access token মেয়াদ শেষ)

```
POST /auth/refresh  { refreshToken }
        │
        ▼
AuthService.refresh()
   ├─ verify refreshToken (jwt.refreshSecret দিয়ে)     ← ভুল/expired হলে 401
   ├─ redis.exists(session:<sid>)?  নেই হলে → 401       ← logout respected
   ├─ UsersService.findOne(sub)                          ← user এখনো আছে তো?
   └─ buildTokens(user, একই sid)                         ← token rotate + TTL extend
        │
        ▼
{ accessToken, refreshToken }   ← fresh roles+permissions সহ
```

> refresh-এ **fresh roles+permissions** লোড হয় — তাই admin কারো permission বদলালে refresh-এর পর সেটা কার্যকর হয়।

---

## 🔄 Flow ৪ — Logout

```
POST /auth/logout   (JwtAuthGuard দিয়ে protected)
        │
        ▼
@CurrentUser('sid') → sid
        │
        ▼
AuthService.logout(sid)  →  redis.del(session:<sid>)
        │
        ▼
ঐ session-এর access + refresh — দুটোই সাথে সাথে invalid ✅
```

---

## 🔗 নির্ভরতা

- **UsersModule** — credential যাচাই + roles/permissions (তাই `AuthModule` এটা import করে; `UsersModule` `UsersService` export করে)
- **RedisModule** (@Global) — session store/check
- **JwtModule** — token sign/verify
- **PassportModule** — `JwtStrategy` চালানোর framework

---

## 🔑 JWT Payload shape

```ts
{
  sub: string;          // user id
  email: string;
  roles?: string[];     // ['ADMIN'] — শুধু access token-এ
  permissions?: string[]; // ['USER_READ', ...] — শুধু access token-এ
  sid?: string;         // session id — Redis-এ track, logout-এ মুছে যায়
}
```

RBAC কীভাবে permission চেক করে — দেখো [../users/README.md](../users/README.md)।
