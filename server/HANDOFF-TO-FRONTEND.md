# 给小前的对接文档 — S2 后端已就绪

> 来自小后（后端），2026-06-25
> S1 认证 + S2 联系人/提醒/回复 全部完成

---

## 一、后端服务启动方式

```bash
cd server
cp .env.example .env    # 首次需要
npm install              # 首次需要
npx prisma migrate dev   # 首次需要，初始化数据库
npm run start:dev        # 启动开发服务，端口 3000
```

启动后：
- API 基础地址: `http://localhost:3000/api`
- Swagger 文档: `http://localhost:3000/api/docs`（可交互调试）

---

## 二、认证机制

### Token 体系

| Token | 有效期 | 用途 |
|-------|--------|------|
| `accessToken` | 15 分钟 | 放在请求头 `Authorization: Bearer <token>` 访问受保护 API |
| `refreshToken` | 30 天 | 调用 refresh 接口换取新的 accessToken |

**前端需要做的**：
1. 登录成功后将两个 token 存入安全存储（Keychain / SecureStorage）
2. 所有受保护请求的请求头带上 `Authorization: Bearer <accessToken>`
3. accessToken 过期（收到 401）时，自动调用 refresh 接口获取新 token 并重试
4. refresh 接口会同时返回新的 accessToken 和 refreshToken，两个都要更新
5. refreshToken 也过期时，跳转登录页

---

## 三、API 接口清单

### 公开接口（无需 Token）

#### 1. 发送验证码

```
POST /api/auth/send-code
```

请求：
```json
{ "phone": "13812345678" }
```

响应：
```json
{
  "message": "验证码已发送",
  "cooldownSeconds": 60,
  "mockCode": "171692"
}
```

- 同一手机号 60 秒冷却期，冷却期内返回剩余秒数
- **`mockCode` 字段仅开发环境返回**，生产环境不会有这个字段
- 手机号格式：`/^1[3-9]\d{9}$/`，不合法返回 400

---

#### 2. 验证码登录（自动注册）

```
POST /api/auth/verify-code
```

请求：
```json
{ "phone": "13812345678", "code": "171692" }
```

响应（成功）：
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": {
    "id": "cmqs33ej2...",
    "phone": "13800001111",
    "nickname": null,
    "isOnboarded": false,
    "onboardingStep": "agreement"
  }
}
```

- 新用户自动注册，`onboardingStep` 初始为 `"agreement"`
- 验证码错误或过期返回 401

---

#### 3. 刷新 Token

```
POST /api/auth/refresh
```

请求：
```json
{ "refreshToken": "eyJhbG..." }
```

响应：
```json
{
  "accessToken": "eyJhbG...(新)",
  "refreshToken": "eyJhbG...(新)"
}
```

- 两个 token 都会返回新值，前端需要同时更新
- refreshToken 无效或过期返回 401，此时应跳转登录页

---

### 受保护接口（需要 Bearer Token）

#### 4. 获取当前用户完整信息

```
GET /api/auth/me
```

响应：
```json
{
  "id": "cmqs33ej2...",
  "phone": "13800001111",
  "nickname": null,
  "address": null,
  "onboardingStep": "agreement",
  "isOnboarded": false,
  "notificationAuth": false,
  "createdAt": "2026-06-24T13:03:21.423Z",
  "updatedAt": "2026-06-24T13:03:21.423Z",
  "contacts": [],
  "reminderConfig": null,
  "guardStatus": null,
  "subscription": null,
  "guardianOf": [],
  "wardOf": []
}
```

- App 启动时用这个接口恢复用户状态
- 返回所有关联数据（联系人、提醒配置、守护状态、订阅、子女关系）

---

#### 5. 获取用户资料

```
GET /api/user/profile
```

响应同 `/api/auth/me` 但不包含关联数据，只有用户基本字段。

---

#### 6. 更新用户资料

```
PATCH /api/user/profile
```

请求（部分更新，只传需要修改的字段）：
```json
{
  "nickname": "小李",
  "address": "北京市朝阳区xxx",
  "notificationAuth": true
}
```

---

#### 7. 更新引导进度

```
PATCH /api/user/onboarding
```

请求：
```json
{
  "step": "basic-info",
  "isOnboarded": false
}
```

- `step` 可选值见下方引导流程
- 完成全部引导步骤后，`isOnboarded` 设为 `true`

---

### S2 新增 — 紧急联系人（6 个接口）

#### 8. 获取联系人列表

```
GET /api/contacts
```

响应：
```json
[
  {
    "id": "cmqsvavqh...",
    "userId": "cmqsvavn2...",
    "name": "妈妈",
    "phone": "13811112222",
    "relation": "母亲",
    "priority": 1,
    "verified": false,
    "createdAt": "2026-06-25T02:12:59.562Z",
    "updatedAt": "2026-06-25T02:12:59.562Z"
  }
]
```

- 按 priority 升序排列
- `verified` 为 false 表示手机号尚未验证

---

#### 9. 创建联系人

```
POST /api/contacts
```

请求：
```json
{
  "name": "妈妈",
  "phone": "13811112222",
  "relation": "母亲",
  "priority": 1
}
```

- `relation` 选填，默认 `"家人"`
- `priority` 选填，默认自动递增
- 免费版最多 1 个联系人，超过返回 400：`"免费版最多添加 1 个联系人，升级守护版可添加更多"`
- 付费版最多 5 个

---

#### 10. 更新联系人

```
PATCH /api/contacts/:id
```

请求（部分更新）：
```json
{
  "name": "老妈",
  "priority": 1
}
```

- 修改 `phone` 后 `verified` 会重置为 false，需要重新验证
- 操作别人的联系人返回 403

---

#### 11. 删除联系人

```
DELETE /api/contacts/:id
```

响应：
```json
{ "message": "联系人已删除" }
```

- 只剩 1 个联系人时删除会返回 400：`"至少保留 1 个紧急联系人"`
- 操作别人的联系人返回 403

---

#### 12. 发送联系人验证短信

```
POST /api/contacts/:id/send-code
```

响应：
```json
{
  "message": "验证码已发送",
  "cooldownSeconds": 60,
  "mockCode": "687754"
}
```

- 给用户填写的联系人手机号发短信验证码
- 60 秒冷却期，逻辑同登录验证码
- **`mockCode` 仅开发环境返回**

---

#### 13. 验证联系人手机号

```
POST /api/contacts/:id/verify
```

请求：
```json
{ "code": "687754" }
```

响应：
```json
{
  "message": "联系人已验证",
  "contact": {
    "id": "...",
    "name": "老妈",
    "phone": "13811112222",
    "verified": true
  }
}
```

- 验证码错误或过期返回 400

---

### S2 新增 — 提醒配置（2 个接口）

#### 14. 获取提醒配置

```
GET /api/reminder/config
```

响应：
```json
{
  "id": "cmqsvawlr...",
  "userId": "cmqsvavn2...",
  "startTime": "20:00",
  "endTime": "22:00",
  "gracePeriodMin": 30,
  "timezone": "Asia/Shanghai",
  "createdAt": "2026-06-25T02:13:00.687Z",
  "updatedAt": "2026-06-25T02:13:00.687Z"
}
```

- 首次调用自动创建默认配置（20:00-22:00，30分钟宽限）

---

#### 15. 更新提醒配置

```
PATCH /api/reminder/config
```

请求（部分更新）：
```json
{
  "startTime": "19:00",
  "endTime": "21:00"
}
```

- `startTime` / `endTime` 格式 `HH:mm`
- `gracePeriodMin` 范围 0-120 分钟
- `timezone` 默认 `Asia/Shanghai`

---

### S2 新增 — 每日回复 & 守护状态（3 个接口）

#### 16. 今日回复

```
POST /api/reply/today
```

响应：
```json
{
  "message": "收到，安心了",
  "repliedAt": "2026-06-25T02:13:01.191Z",
  "guardStatus": "replied",
  "alertResolved": false
}
```

- 今天已回复时再次调用返回 400：`"今天已回复"`
- 如果有活跃的告警，会自动解除（`alertResolved: true`）

---

#### 17. 撤回今日回复

```
DELETE /api/reply/today
```

响应：
```json
{
  "message": "已撤回回复",
  "guardStatus": "waiting"
}
```

- 今天未回复时调用返回 400：`"今天尚未回复"`

---

#### 18. 获取守护状态

```
GET /api/reply/status
```

响应：
```json
{
  "status": "replied",
  "lastReplyAt": "2026-06-25T02:13:01.191Z",
  "todayReplied": true,
  "todayRepliedAt": "2026-06-25T02:13:01.191Z",
  "reminderConfig": {
    "startTime": "19:00",
    "endTime": "21:00",
    "gracePeriodMin": 30,
    "timezone": "Asia/Shanghai"
  },
  "monthlyStats": {
    "repliedDays": 1,
    "totalDays": 25,
    "daysInMonth": 30,
    "display": "本月平安 1/25 天"
  }
}
```

- `status` 可选值：`idle`（初始）、`waiting`（待回复）、`replied`（已回复）、`grace`（宽限期）、`alert`（告警中）、`paused`（已暂停）
- `monthlyStats.display` 直接可用于首页展示
- 首页状态机可根据 `status` + `todayReplied` 组合判断显示哪种卡片

---

## 四、引导流程（Onboarding）

### 步骤定义

```typescript
type OnboardingStep =
  | 'login'           // 登录页（不计入步骤进度）
  | 'agreement'       // 第1步：协议页
  | 'basic-info'      // 第2步：基本信息（调 PATCH /api/user/profile 更新 nickname/address）
  | 'contact-setup'   // 第3步：紧急联系人（调 POST /api/contacts + send-code + verify）
  | 'reminder-time'   // 第4步：提醒时间（调 PATCH /api/reminder/config）
  | 'notification-auth' // 第5步：通知授权（调 PATCH /api/user/profile 更新 notificationAuth）
  | 'complete';       // 完成（不计入步骤进度）
```

### 流程

```
login → agreement → basic-info → contact-setup → reminder-time → notification-auth → complete
```

- 每完成一步调用 `PATCH /api/user/onboarding` 更新 `step` 到下一步
- 最后一步完成后设 `isOnboarded: true`
- 用户中途退出，下次打开根据 `onboardingStep` 从断点继续

### 各步骤调用的 API

| 步骤 | 调用的接口 |
|------|-----------|
| agreement | 无（前端展示协议，用户勾选同意） |
| basic-info | `PATCH /api/user/profile` → `PATCH /api/user/onboarding` |
| contact-setup | `POST /api/contacts` → `POST /api/contacts/:id/send-code` → `POST /api/contacts/:id/verify` → `PATCH /api/user/onboarding` |
| reminder-time | `PATCH /api/reminder/config` → `PATCH /api/user/onboarding` |
| notification-auth | `PATCH /api/user/profile {notificationAuth: true}` → `PATCH /api/user/onboarding` |

---

## 五、数据模型参考

前端类型定义（`types/index.ts`）已有以下 interface，后端数据结构与之对齐：

| 前端类型 | 后端表名 | 说明 |
|----------|---------|------|
| `User` | `User` | 用户主表 |
| `EmergencyContact` | `EmergencyContact` | 紧急联系人 |
| `ReminderConfig` | `ReminderConfig` | 提醒时间配置 |
| `DailyRecord` | `DailyRecord` | 每日回复记录 |
| `AlertEvent` | `AlertEvent` + `AlertAction` | 告警事件 + 处理记录 |
| `Guardian` | `GuardianRelation` | 子女端守护关系 |
| `SubscriptionPlan` | `Subscription` | 订阅信息 |
| `ReplyStatus` | `GuardStatus.status` | 守护状态 |

---

## 六、Zustand Store 对接

当前 store（`store/useStore.ts`）使用 mock 数据，现在可以全部替换为真实 API：

| Store 字段 | 对接的 API |
|-----------|-----------|
| `user` | `verify-code` 响应 / `GET /api/auth/me` |
| `isOnboarded` | `user.isOnboarded` |
| `onboardingStep` | `user.onboardingStep` |
| `contacts` | `GET /api/contacts` |
| `reminder` | `GET /api/reminder/config` |
| `todayStatus` | `GET /api/reply/status` → `status` 字段 |
| `notificationAuthorized` | `user.notificationAuth` |

Store 中已有的 action 对接：
| Action | 调用 API |
|--------|---------|
| `setUser` | 本地状态更新 |
| `addContact` | `POST /api/contacts` |
| `updateContact` | `PATCH /api/contacts/:id` |
| `removeContact` | `DELETE /api/contacts/:id` |
| `setReminder` | `PATCH /api/reminder/config` |
| `reply` | `POST /api/reply/today` |
| `undoReply` | `DELETE /api/reply/today` |
| `setNotificationAuthorized` | `PATCH /api/user/profile` |

---

## 七、错误码约定

| HTTP 状态码 | 含义 | 前端处理 |
|-------------|------|----------|
| 200 | 成功 | 正常处理 |
| 400 | 请求参数错误 / 业务限制 | 显示 message 中的具体错误 |
| 401 | 未认证 / Token 过期 | 先尝试 refresh，refresh 也 401 则跳登录 |
| 403 | 无权操作 | 提示无权访问 |
| 404 | 资源不存在 | 提示数据不存在 |
| 429 | 请求过于频繁 | 提示用户稍后再试 |
| 500 | 服务器错误 | 显示通用错误提示 |

---

## 八、完整 API 汇总表

| # | 方法 | 路径 | Token | 说明 |
|---|------|------|-------|------|
| 1 | POST | `/api/auth/send-code` | 否 | 发送登录验证码 |
| 2 | POST | `/api/auth/verify-code` | 否 | 验证码登录 |
| 3 | POST | `/api/auth/refresh` | 否 | 刷新 token |
| 4 | GET | `/api/auth/me` | 是 | 获取完整用户信息 |
| 5 | GET | `/api/user/profile` | 是 | 获取基本资料 |
| 6 | PATCH | `/api/user/profile` | 是 | 更新资料 |
| 7 | PATCH | `/api/user/onboarding` | 是 | 更新引导进度 |
| 8 | GET | `/api/contacts` | 是 | 联系人列表 |
| 9 | POST | `/api/contacts` | 是 | 创建联系人 |
| 10 | PATCH | `/api/contacts/:id` | 是 | 更新联系人 |
| 11 | DELETE | `/api/contacts/:id` | 是 | 删除联系人 |
| 12 | POST | `/api/contacts/:id/send-code` | 是 | 发送联系人验证短信 |
| 13 | POST | `/api/contacts/:id/verify` | 是 | 验证联系人手机号 |
| 14 | GET | `/api/reminder/config` | 是 | 获取提醒配置 |
| 15 | PATCH | `/api/reminder/config` | 是 | 更新提醒配置 |
| 16 | POST | `/api/reply/today` | 是 | 今日回复 |
| 17 | DELETE | `/api/reply/today` | 是 | 撤回今日回复 |
| 18 | GET | `/api/reply/status` | 是 | 获取守护状态 |

---

## 九、开发建议

1. 用 `mockCode` 字段自动填充验证码输入框（登录 + 联系人验证，仅开发环境）
2. Swagger 文档 `http://localhost:3000/api/docs` 可直接在浏览器里调试所有接口
3. 首页状态机根据 `GET /api/reply/status` 的 `status` 字段判断显示哪种卡片
4. 引导流程的联系人设置步骤：创建联系人 → 发送验证短信 → 验证，三步完成后再进入下一步
5. 有任何接口问题随时找我
