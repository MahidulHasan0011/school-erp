# 👤 Users Module — কীভাবে কাজ করে

> User account-এর CRUD + password ব্যবস্থাপনা + RBAC-এর মূল data উৎস
> (role → permission)। `AuthModule` এই module-এর উপর দাঁড়িয়ে আছে।

---

## 📁 ফাইলগুলোর দায়িত্ব (module বানানোর standard ৭ ধাপ)

| ফাইল | কাজ |
|------|-----|
| `entities/user.entity.ts` | `users` table-এর mapping (password column `select:false`) |
| `dto/*.dto.ts` | input validation: `create`, `update`, `query`, `change-password`, `reset-password` |
| `users.repository.ts` | সব DB query এক জায়গায় (service সরাসরি Repository ধরে না) |
| `users.service.ts` | business logic: bcrypt hash, duplicate check, password strip |
| `users.controller.ts` | HTTP endpoint + RBAC guard/permission |
| `users.module.ts` | wire up + `UsersService` export (AuthModule-এর জন্য) |

---

## 🧠 মূল নীতিগুলো

1. **Password কখনো leak হয় না।**
   - entity-তে password column `select: false` — সাধারণ query-তে আসেই না।
   - auth-এর জন্য দরকার হলে repository `.addSelect('user.password')` দিয়ে explicitly আনে।
   - service `stripPassword()` দিয়ে response থেকে hash মুছে দেয়।
   - সংরক্ষণ হয় সবসময় **bcrypt hash** (rounds = 10), কখনো plain text নয়।

2. **Repository pattern:** service কখনো raw `Repository<User>` ধরে না — সব query `UsersRepository`-তে। ফলে query logic এক জায়গায়, test/change সহজ।

3. **Sortable allow-list:** `SORTABLE_COLUMNS` — client যা খুশি column দিয়ে sort করতে পারে না (SQL injection ঠেকায়)। `safeSortColumn()` allow-list-এ না থাকলে default `createdAt`-এ ফেরত যায়।

4. **Server-set field:** create DTO-তে শুধু client যা দেবে তাই থাকে; `id`, timestamps, `password hash` — এগুলো server নিজে সেট করে।

---

## 🔄 Flow ১ — নতুন user তৈরি

```
POST /users   { email, password, fullName, roleId, ... }
        │
        ▼
JwtAuthGuard + PermissionsGuard(@Permissions('USER_CREATE'))
        │
        ▼
UsersService.create(dto)
   ├─ findByEmailWithPassword(email)  →  আছে হলে → 409 Conflict
   ├─ bcrypt.hash(password, 10)
   ├─ repo.create({ ...dto, password: hash })
   ├─ repo.save(user)
   └─ stripPassword(user)                ← response-এ hash নেই
        │
        ▼
201 { id, email, fullName, ... }
```

---

## 🔄 Flow ২ — Paginated list (search + filter + safe sort)

```
GET /users?search=john&isActive=true&roleId=002&sortBy=email&order=asc&page=1&limit=10
        │
        ▼
UsersRepository.findPaginated(query)
   ├─ createQueryBuilder('user').leftJoinAndSelect('user.role', 'role')
   ├─ applySearch(qb, 'user', ['fullName','email'], search)
   ├─ applyFilters(qb, 'user', { isActive, roleId, gender })
   ├─ safeSortColumn(sortBy, SORTABLE_COLUMNS, 'createdAt')   ← injection guard
   ├─ applyPagination(qb, 'user', { skip, limit, sortBy, order })
   └─ getManyAndCount()   →  [rows, total]
        │
        ▼
paginate(data, total, page, limit)   ← standard { data, meta } shape
```

---

## 🔄 Flow ৩ — RBAC-এর হৃদয়: `findAccessControl` (login-এ ডাকা হয়)

> এই function-টাই ঠিক করে একজন user কী কী করতে পারবে।

```
UsersRepository.findAccessControl(userId)
        │
        ▼
repo.findOne({
  where: { id },
  relations: { role: { rolePermissions: { permission: true } } }
})
        │  ← TypeORM relation চেইন:
        │     user → role → role_permissions → permission
        │     (সব entity-তে @DeleteDateColumn → soft-deleted row বাদ)
        ▼
{
  roles:       ['ADMIN'],
  permissions: [...new Set(['USER_READ','USER_CREATE', ...])]  ← dedupe
}
        │
        ▼
AuthService.buildTokens() এটা access token-এ embed করে
```

তারপর প্রতিটা request-এ:

```
@Permissions('USER_UPDATE')  →  PermissionsGuard
        │
        ▼
required.every(p => req.user.permissions.includes(p))
        ├─ সব আছে → route চলে ✅
        └─ কোনোটা নেই → 403 Forbidden
```

---

## 🔄 Flow ৪ — Password পরিবর্তন

**নিজে (self-service, permission লাগে না):**
```
PATCH /users/me/password  { oldPassword, newPassword }
   └─ findByIdWithPassword → bcrypt.compare(old) → ভুল হলে 400
      → hash(new) → save
```

**Admin reset (`USER_UPDATE`):**
```
PATCH /users/:id/reset-password  { newPassword }
   └─ পুরনো password ছাড়াই → hash(new) → save
```

---

## 🛣️ Route সারসংক্ষেপ

| Method | Path | Permission | কাজ |
|--------|------|-----------|-----|
| PATCH | `/users/me/password` | — (logged-in) | নিজের password বদল |
| GET | `/users` | `USER_READ` | list (paginated) |
| GET | `/users/:id` | `USER_READ` | একটি user |
| POST | `/users` | `USER_CREATE` | নতুন user |
| PATCH | `/users/:id` | `USER_UPDATE` | update |
| DELETE | `/users/:id` | `USER_DELETE` | মুছে ফেলা |
| PATCH | `/users/:id/reset-password` | `USER_UPDATE` | admin reset |
| PATCH | `/users/:id/toggle-active` | `USER_UPDATE` | active on/off |

---

## 🔗 নির্ভরতা

- **TypeOrmModule.forFeature([User])** — DB access
- **exports: [UsersService]** — যাতে `AuthModule` credential যাচাই + access control পায়

Login/token/session কীভাবে হয় — দেখো [../auth/README.md](../auth/README.md)।
