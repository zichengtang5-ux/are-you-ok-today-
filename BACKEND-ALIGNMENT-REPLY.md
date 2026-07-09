# 后端对齐回复 — 回应 BACKEND-ALIGNMENT-PENDING.md

> 回复者：后端
> 回复日期：2026-06-28
> 代码审查基线：main 分支（commit `04ed1f9`）
> 状态：B1-B9 / N1-N5 / D1-D5 已逐项回复

---

## 审查中发现的后端 Bug（需修复）

在逐条回复之前，先列出代码审查中发现的 **4 个实际 bug**，这些问题会影响前端对接：

| # | 严重度 | 问题 | 文件 | 影响 |
|---|--------|------|------|------|
| BUG-1 | P0 | `GET /reply/status` 不检查暂停过期 | `reply.service.ts:104-146` | 暂停到期后如果没有人调 `GET /pause/status`，GuardStatus 仍然是 `'paused'`，首页永远显示暂停 |
| BUG-2 | P1 | `DELETE /reply/today` 撤回不恢复告警 | `reply.service.ts:80-102` | 用户回复后告警被 resolve，撤回回复后告警仍然是 resolved，不会重新触发 |
| BUG-3 | P1 | 切换设备不清理旧 token | `device.service.ts` | 用户换手机后旧设备仍会收到推送 |
| BUG-4 | P2 | `DELETE /user/account` 用 `userId` 匹配 `phone` 字段 | `user.controller.ts:76` | VerificationCode 清理逻辑有 bug，`phone` 字段应该匹配用户手机号而非 userId |

**修复计划**：BUG-1/2/3 在后端对齐 PR 中一并修复（约 0.5 天）。BUG-4 低优先级，同 PR 顺带修复。

---

## 一、B 类契约确认回复（B1-B9）

### B1 · `GET /reply/status` 是否原生返回 `paused` 状态？

**回复：是，直接返回 `'paused'`，不需要前端合并。**

当前实现：`PauseService.pause()` 会把 `GuardStatus.status` 直接写为 `'paused'`（`pause.service.ts:30`），所以 `GET /reply/status` 读 `GuardStatus.status` 时确实会返回 `'paused'`。

**但有一个 Bug（BUG-1）**：暂停过期后自动恢复逻辑只在 `PauseService.getStatus()` 中（`pause.service.ts:78-91`），而 `GET /reply/status` 不会调用它。这意味着暂停到期后如果没有人调 `/pause/status`，status 会一直卡在 `'paused'`。

**修复方案**：在 `ReplyService.getStatus()` 开头增加暂停过期检查逻辑，过期后自动将 status 恢复为 `'idle'`。前端无需改动。

---

### B2 · `POST /reply/today` 在 `paused` 状态下的行为

**回复：当前行为是方案 B（允许 + 自动覆盖为 replied），但这不是设计意图，属于遗漏。**

当前实现：`ReplyService.replyToday()` 没有检查 `GuardStatus.status === 'paused'`（`reply.service.ts:23-78`）。暂停期间用户调回复接口会成功，GuardStatus 被覆写为 `'replied'`，但 `PauseLog` 的 `isActive` 仍为 `true`，导致数据不一致。

**修复方案**：改为**方案 A**。后端在 `replyToday()` 开头检查暂停状态：
- 如果 `GuardStatus.status === 'paused'` → 返回 `409 Conflict`
- 响应体：`{ "statusCode": 409, "message": "守护已暂停，请先恢复守护", "error": "Conflict" }`
- 前端收到 409 后引导用户先恢复守护

---

### B3 · `GET /alert/active` 当用户自己查看时的返回

**回复：此接口当前不存在，需要新增。**

代码审查发现后端**没有实现** `GET /alert/active` 接口。当前只有 `GET /reply/status` 返回 status 字段。告警详情（时间线、已通知联系人等）需要通过其他路径获取。

**修复方案**：新增 `GET /alert/active` 接口，返回结构如下：

```json
{
  "id": "alert-001",
  "triggeredAt": "2026-06-25T22:30:00Z",
  "lastReplyAt": "2026-06-24T20:15:00Z",
  "contactsNotified": [
    { "id": "c1", "name": "妈妈", "phone": "138****2222" }
  ],
  "timeline": [
    { "time": "22:00", "action": "发送了每日提醒" },
    { "time": "22:30", "action": "通知了紧急联系人", "isCurrent": true }
  ]
}
```

- 无活跃告警时返回 `null`（HTTP 200，body 为 null）
- 用户视角**不包含** `smsRounds`（前端同意去掉）
- `contactsNotified` 中手机号脱敏展示

**工作量**：0.5 天

---

### B4 · `POST /device/register` 时机与幂等性

**回复：当前是 upsert（幂等），但缺少旧 token 清理。**

当前实现：以 `userId + token` 为唯一键做 upsert（`schema.prisma: @@unique([userId, token])`），同一 token 重复注册只更新 platform。

**问题（BUG-3）**：用户换设备时旧 token 不会自动清理，导致旧设备仍收到推送。

**修复方案**：改为**单设备模式**——每次 `POST /device/register` 时先删除该用户所有旧 device 记录，再 upsert 当前 token。这样保证一个用户只保留最新一个 device token。

```
POST /device/register → 删除 userId 所有旧 Device 行 → 创建新行
```

前端只需：每次 App 启动 + token 变化时调一次 `POST /device/register`，无需关心清理逻辑。

---

### B5 · `DELETE /user/account` 的清理范围

**回复：当前实现不处理"被其他人关联为紧急联系人"的情况。**

当前实现：`DELETE /user/account` 在一个事务中删除用户自己的所有数据（AlertAction、AlertEvent、NotificationLog、EmergencyContact、DailyRecord、GuardStatus、ReminderConfig、PauseLog、HelpRequest、AgreementConsent、Device、Subscription、GuardianRelation、VerificationCode、User），共 15 步级联删除。

**未处理的情况**：如果用户 A 是用户 B 的紧急联系人，删除用户 A 不会删除用户 B 的 EmergencyContact 表中对应的行。用户 B 的联系人列表会保留一条"空壳"联系人（手机号仍存在但用户已注销）。

**决策：方案 A**（保留条目，标记为已注销）：
1. 删除账号时，查找所有 `EmergencyContact` 行中 `phone === 被删用户手机号` 的记录
2. 将这些行的 `phone` 脱敏为 `***`，新增 `isAccountDeleted: true` 标记
3. 通知下发时跳过 `isAccountDeleted: true` 的联系人
4. `GuardianRelation` 已经做了双向清理（`OR: [{ guardianId }, { wardId }]`），不需要额外处理

**Prisma schema 改动**：`EmergencyContact` 模型新增 `isAccountDeleted Boolean @default(false)` 字段

**工作量**：0.5 天

---

### B6 · `POST /guardian/wards/:id/proxy-reply` 的权限模型

**回复：逐项回答如下**

1. **权限**：只检查 `relation.guardianId === 当前登录用户`（`guardian.service.ts:253`），不检查 ward 是否处于 alert/waiting 状态。**任何已绑定的 guardian 都能代确认**。但有一个 bug：未绑定的邀请中关系也能代确认，需要修复（增加 `isBound: true` 校验）。

2. **代确认后自动解除告警**：**是**。代确认调用的是 `replyService.replyToday(wardId)`（`guardian.service.ts:259`），这个方法会自动把 ward 的活跃 AlertEvent 标记为 `resolved`。

3. **ward 本人下次刷新看到的状态**：`GuardStatus.status = 'replied'`，`todayReplied: true`，`consecutiveTimeouts` 重置为 0。ward 本人无法区分是自己回复还是代确认。

**修复**：增加 `isBound` 校验，防止未绑定关系被滥用。

---

### B7 · `GET /guardian/wards/:id/dashboard` 付费降级字段

**回复：确认返回 `null`，不会字段缺失。**

当前实现（`guardian.service.ts:186-197`）：

```typescript
if (!guardianIsPremium) {
  return {
    wardName, status, lastReplyAt,
    recentDays: null,      // 明确 null
    monthlyStats: null,    // 明确 null
    history: null,         // 明确 null
    isPremium: false,
    upgradeHint: '升级守护版查看完整关怀数据',
  };
}
```

前端 TypeScript 类型可以安全定义为 `recentDays: RecentDay[] | null`。

---

### B8 · `GET /subscription/status` 返回 `expired` 时是否自动清理

**回复：实时判定（懒标记），不是定时任务。**

当前实现（`subscription.service.ts:128-139`）：每次调 `GET /subscription/status` 时，如果 subscription 是 `active/trial` 且 `currentPeriodEnd < now`，会**即时写入** `expired` 到数据库并返回。没有后台定时任务扫描过期。

**对 dashboard 的影响**：`GET /guardian/wards/:id/dashboard` 内部会调 `getSubscriptionStatus(guardianId)` 检查付费状态（`guardian.service.ts:276`），也是实时判定。所以**订阅过期后第一次调 dashboard 就会降级**，不需要等定时任务。

**注意**：存在一个边界情况——如果用户从未调过 `/subscription/status`，dashboard 的内部检查也能正确判定过期（因为它自己做了 `currentPeriodEnd < now` 的判断）。所以**前端无需担心**。

---

### B9 · `POST /pause` 的天数上限

**回复：后端严格校验，拒绝 `days > 30`。**

当前实现（`pause/dto/pause.dto.ts`）：

```typescript
@IsInt()
@Min(1)
@Max(30)
days!: number;
```

超过 30 天会被 NestJS ValidationPipe 拦截，返回：

```json
{
  "statusCode": 400,
  "message": ["days must not be greater than 30"],
  "error": "Bad Request"
}
```

前端 UI 限制 + 后端校验双重兜底，**已就绪，无需改动**。

---

## 二、N 类新增/调整接口回复（N1-N5）

### N1 · 首页状态机"撤销回复"能力

**回复：`DELETE /reply/today` 已实现，但有两个问题需修复。**

1. **撤销窗口期**：当前**没有窗口期限制**，当天任何时候都能撤销。同意前端建议：限制为当天 23:59:59 前可撤销（本质上是"当天有效"）。实际上当前已经隐式满足——`undoReply` 查找的是当天的 `DailyRecord`，跨天后查不到记录自然无法撤销。**无需改动**。

2. **撤销后 status 变化**：当前统一设为 `'waiting'`（`reply.service.ts:98`）。但这不够准确——如果撤销时已过提醒窗口，应该是 `'grace'` 而非 `'waiting'`。
   - **修复方案**：撤销时根据当前时间判定：
     - 当前时间 < 窗口结束时间 → `status: 'waiting'`
     - 当前时间 >= 窗口结束时间 → `status: 'grace'`

3. **Bug（BUG-2）**：撤销回复不会重新激活已 resolve 的告警。
   - **修复方案**：如果撤销时距离原回复时间超过 30 分钟（告警可能已触发），撤销应同时创建新的 active AlertEvent。

**工作量**：0.5 天

---

### N2 · 子女端"我守护的人"状态刷新机制

**回复：同意 Phase 1 用 pull 模型。**

- 前端 30 秒轮询 `GET /guardian/wards` + `GET /guardian/wards/:id/dashboard`
- 后端**不设调用频率上限**（NestJS 默认无 rate limit），但建议前端加 30 秒最小间隔
- Phase 2 评估 WebSocket / SSE push

**无需后端改动。**

---

### N3 · 联系人短信验证码复用

**回复：是的，更新手机号后 `verified` 自动变 `false`。**

当前实现（`contact.service.ts:72-75`）：

```typescript
if (data.phone !== undefined) {
  updateData.phone = data.phone;
  updateData.verified = false;
}
```

**注意**：即使新旧手机号相同，只要 payload 中包含 `phone` 字段就会重置。前端编辑表单如果不改手机号，应该不传 `phone` 字段。

**无需后端改动。**

---

### N4 · 守护暂停的恢复入口 API

**回复：是的，首页 paused 卡片点击"恢复守护"直接调 `POST /pause/resume`。**

`POST /pause/resume`（`pause.service.ts`）会：
1. 将 `PauseLog.isActive` 设为 `false`
2. 将 `GuardStatus.status` 设为 `'idle'`
3. 返回 `{ message: '守护已恢复', guardStatus: 'idle' }`

前端收到响应后刷新 `GET /reply/status`，status 应变为 `'idle'`。

**无需后端改动。**

---

### N5 · 删除账号前的关联告知

**回复：`/auth/me` 中 `guardianOf` / `wardOf` 的结构如下。**

当前实现（`auth.service.ts:147-148`）的 Prisma include：

```typescript
guardianOf: { include: { ward: { select: { id: true, phone: true, nickname: true } } } },
wardOf: { include: { guardian: { select: { id: true, phone: true, nickname: true } } } },
```

返回的完整结构：

```typescript
// guardianOf[i] — 我守护的人
{
  id: string;           // 关系 ID
  guardianId: string;   // 我的 userId
  wardId: string;       // 对方的 userId
  relation: string;     // 如 "子女"
  inviteCode: string | null;
  isBound: boolean;
  createdAt: string;
  updatedAt: string;
  ward: {
    id: string;
    phone: string;      // 完整手机号（未脱敏）
    nickname: string | null;
  }
}

// wardOf[i] — 守护我的人
{
  id: string;
  guardianId: string;
  wardId: string;
  relation: string;
  inviteCode: string | null;
  isBound: boolean;
  createdAt: string;
  updatedAt: string;
  guardian: {
    id: string;
    phone: string;      // 完整手机号（未脱敏）
    nickname: string | null;
  }
}
```

**与前端期望的差异**：前端期望的简化结构 `{ id, wardName, wardPhone }` 与实际返回不同。实际返回的是嵌套结构，`wardName` 对应 `ward.nickname`，`wardPhone` 对应 `ward.phone`。

**建议**：前端直接适配当前结构，或者后端新增一个 `/api/user/relations` 轻量接口返回简化格式。**推荐前端适配**，因为 `/auth/me` 已经包含了所有需要的信息。

---

## 三、D 类设计决策回复（D1-D5）

### D1 · 首页告警态的"需要帮助"入口

**回复：后端支持，`POST /help/emergency` 已就绪。**

同意前端方案：首页 `alert` 状态下增加"我需要帮助"副按钮，复用紧急求助流程。

后端 `POST /help/emergency` 不需要改动。产品侧需确认 UI 设计。

---

### D2 · 紧急求助页地址来源优先级

**回复：同意前端方案——自动用 GPS，GPS 失败时回退到 `GET /help/address`。**

后端不需要改动。`POST /help/emergency` 已经支持 `latitude/longitude` 可选 + `addressText` 可选。

---

### D3 · 子女代付订阅的入口位置

**回复：复用 `GET /guardian/wards` 过滤 `isBound: true`，不需要新增接口。**

`GET /guardian/wards` 已返回 `isBound` 字段，前端过滤即可。代付流程：
1. 前端调 `GET /guardian/wards`，过滤 `isBound: true`
2. 用户选择代付目标
3. StoreKit 购买成功后调 `POST /subscription/proxy-subscribe`，传 `wardId`

**无需后端改动。**

---

### D4 · 首页"消息推送未授权"提示的显示策略

**回复：同意前端方案——`idle` + `replied` 时显示，`alert/grace` 时不显示。**

这是纯前端逻辑，后端不参与。

---

### D5 · 看板页"本月平安 X/Y 天"的计算基准

**回复：`monthlyStats` 的字段定义如下。**

当前实现（`guardian.service.ts:210-217`）：

```typescript
monthlyStats: {
  repliedDays: number;     // 本月已回复天数
  totalDays: number;       // 本月总天数（daysInMonth）
  display: string;         // 如 "本月平安 22/25 天"
}
```

- `repliedDays`：本月内 `DailyRecord.status === 'replied'` 的天数
- `totalDays`：当月总天数（由 `new Date(year, month+1, 0).getDate()` 计算）
- `display`：后端拼好的展示文案

所以 `Y` 分母是**当月总天数**（如 30 或 31），不是当前日期。前端显示用 `monthlyStats.display` 即可，或者自己拼 `${repliedDays}/${totalDays}`。

---

## 四、后端工时评估

| 项 | 工作 | 预估 | 备注 |
|----|------|------|------|
| BUG-1 | `/reply/status` 增加暂停过期检查 | 0.25 天 | 影响 B1 |
| BUG-2 | 撤回回复后重新激活告警 | 0.25 天 | 影响 N1 |
| BUG-3 | 设备注册改为单设备模式 | 0.25 天 | 影响 B4 |
| BUG-4 | `/user/account` 中 VerificationCode 清理修复 | 0.1 天 | 顺带 |
| B2 | `/reply/today` 增加暂停状态检查（返回 409） | 0.25 天 | |
| B3 | 新增 `GET /alert/active` 接口 | 0.5 天 | 含测试 |
| B5 | 删除账号处理关联联系人（方案 A） | 0.5 天 | 含 schema 改动 |
| B6 | proxy-reply 增加 isBound 校验 | 0.1 天 | |
| N1 | 撤销回复后按时间判定 status | 0.25 天 | |
| **合计** | | **2.45 天 ≈ 2.5 天** | |

B1/B4/B7/B8/B9/N2/N3/N4/D1-D5 无需后端改动或改动极小（已包含在上面）。

**排期建议**：后端 2.5 天完成所有修复 + 新增，产出 1 个 PR。前端可并行推进第 1 批（P0-1/2/3/4），后端 PR 合入后前端启动第 2 批。

---

## 五、对齐会议建议

同意前端建议的 30 分钟同步会，补充议题：

1. **B2 + B1**（暂停与回复的交互）— 后端已给方案，需前端确认 409 处理逻辑
2. **B5**（删除账号级联方案 A）— 需确认 `isAccountDeleted` 标记后 UI 如何展示
3. **B3**（新增 `/alert/active` 接口）— 确认返回结构是否满足前端需求
4. **BUG-2**（撤回回复后是否要重新激活告警）— 需产品确认是否允许告警态撤回
5. **D1**（首页告警态"我需要帮助"入口）— 产品侧拍板

---

## 六、确认签字

- [x] 后端已阅读 B1-B9 并逐项回复
- [x] 后端已评估 N1-N5 可行性
- [ ] 产品侧已评估 D1-D5（待产品回复）
- [ ] 双方确认撤销回复窗口期（N1）— 后端建议"当天有效"，待前端确认
- [x] 双方确认删除账号级联策略（B5）— 后端建议方案 A，待前端确认
