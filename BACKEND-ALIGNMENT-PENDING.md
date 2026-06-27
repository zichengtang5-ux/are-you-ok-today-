# 前后端对齐补充文档 — 前端审计结论

> 创建者：前端
> 最后更新：2026-06-28
> 状态：前端审计完成，等待后端对齐
> 关联文档：[FRONTEND-BACKEND-ALIGNMENT.md](./FRONTEND-BACKEND-ALIGNMENT.md)
> 当前分支：`feat/ux-improvements-20260627`（commit `368f239`）

---

## 背景

前端完成一轮完整 UX 审计后，列出 P0（阻塞用户流程）/ P1（功能缺失）/ P2（体验打磨）共 12 项改进工作。其中若干项**需要后端确认 API 契约或新增接口**后才能推进实现。本文档列出全部需后端对齐的事项，便于前后端并行工作。

---

## 一、前端可独立推进（无需等后端）

前端将优先修复以下 P0/P1 项，对齐完成后即可合入：

| # | 项目 | 文件 | 说明 |
|---|------|------|------|
| P0-1 | TabBar 缺失 | `app/src/app/(tabs)/_layout.tsx` | 当前用 `<Stack>` 包了一层，导致底部没有真正的 TabBar。改为 Expo Router 的 `<Tabs>` 并加入吉祥物 tab icon |
| P0-2 | Token 刷新失败不跳转 | `app/src/services/api.ts:51` | 刷新失败只 `clearTokens`，需要 emit `auth:logout` 事件让 `_layout.tsx` 路由到登录页 |
| P0-3 | 删除账号是空壳 | `app/src/app/settings/delete-confirm.tsx:13-18` | 仅 `console.log` + 跳转，需要调 `DELETE /user/account` → 清空 AsyncStorage → 跳转登录 |
| P1-7 | `/confirmed/index.tsx` 死页 | `app/src/app/confirmed/index.tsx` | 直接删除 |

> **说明**：这 4 项前端会先落地，不阻塞后端。

---

## 二、需要后端确认的 API 契约（B 类）

> 这些是现有接口契约存在歧义或缺失字段的地方，前端无法据此完成实现。请后端逐项回复确认或修订。

### B1 · `GET /reply/status` 是否原生返回 `paused` 状态？

- **现状**：前端 `ReplyStatus` 枚举含 `'paused'`，首页状态机已实现 `paused` 分支（"守护已暂停，点击恢复守护"）。
- **问题**：当前后端 `ReplyStatus` 类型定义（`api.types.ts:142`）为 `'idle' | 'waiting' | 'replied' | 'grace' | 'alert' | 'paused'`，但前端无法确认 `GET /reply/status` 在用户处于暂停期时**是否直接返回 `status: 'paused'`**，还是需要客户端结合 `GET /pause/status` 自己合并。
- **前端期望**：后端直接在 `/reply/status` 中返回 `'paused'`（优先级高于 `idle`），避免前端双请求。
- **需回复**：是 / 否。若否，请给出合并逻辑建议。

### B2 · `POST /reply/today` 在 `paused` 状态下的行为

- **现状**：用户在暂停期进入 App，UI 显示"守护已暂停"。
- **问题**：暂停期用户主动点击"今天还好 ✓"是否允许？后端返回什么？
  - 方案 A：拒绝，返回 400/409 + "守护已暂停"，前端引导先恢复
  - 方案 B：允许，自动恢复守护 + 记录回复
- **前端期望**：方案 A（更清晰），但需要后端明确。
- **需回复**：A / B，及对应的 HTTP 状态码。

### B3 · `GET /alert/active` 当用户自己查看时的返回

- **现状**：`api.types.ts:221` 定义 `ActiveAlertResponse` 含 `contactsNotified`、`smsRounds`、`timeline`。
- **问题**：这些字段在**用户自己**查看自己告警时是否有意义？（"已通知联系人"是子女端/联系人端场景）
- **前端期望**：用户视角返回 `contactsNotified`（让用户知道"已经通知了谁"），去掉 `smsRounds`。
- **需回复**：字段范围是否调整。

### B4 · `POST /device/register` 时机与幂等性

- **现状**：前端 `notification-auth.tsx` 拿到权限但没上报 token。
- **问题**：
  1. APNs token 可能多次变化（系统刷新），后端是否支持重复调 `POST /device/register` 做 upsert？
  2. 用户换设备登录时旧 token 是否自动失效？
- **前端期望**：upsert 语义，每次启动 App + 每次 token 变化都调用，后端幂等处理。
- **需回复**：是否 upsert；旧 token 清理策略。

### B5 · `DELETE /user/account` 的清理范围

- **现状**：契约只描述"删除用户数据"。
- **问题**：用户作为**联系人**被其他人关联时，如何处理？
  - 方案 A：保留联系人条目，但把手机号脱敏为 `***`，通知不再下发
  - 方案 B：级联删除所有关联条目，其他人下次查联系人列表自动消失
  - 方案 C：保留，但标记为"已注销"
- **前端期望**：方案 A 或 B，需要后端明确。
- **需回复**：方案 + 级联细节（是否包括守护关系）。

### B6 · `POST /guardian/wards/:id/proxy-reply` 的权限模型

- **现状**：契约说"幂等"。
- **问题**：
  1. 是否任何 guardian 都能对 ward 做代确认，还是需要 ward 当前处于 `alert` / `waiting` 状态？
  2. 代确认后 `ward.status` 是否立即变为 `replied`，告警自动解除？
  3. 子女代确认后，ward 本人 App 下次刷新看到的状态是什么？
- **需回复**：三种情况的具体行为说明。

### B7 · `GET /guardian/wards/:id/dashboard` 付费降级字段

- **现状**：契约说免费用户返回 `null` + 付费引导。
- **问题**：`recentDays`、`monthlyStats`、`history` 返回 `null` 还是字段缺失？前端需要稳定的 TS 类型。
- **前端期望**：统一返回 `null`，不要字段缺失。
- **需回复**：是。

### B8 · `GET /subscription/status` 返回 `expired` 时是否自动清理

- **现状**：契约列了 `active | trial | expired | cancelled | none` 五种状态。
- **问题**：
  1. `expired` 由后端定时任务自动标记，还是每次查实时判定？
  2. 用户从 `active` 变为 `expired` 后，`GET /guardian/wards/:id/dashboard` 是否立即降级？
- **前端期望**：实时判定，dashboard 立即降级。
- **需回复**：是 / 否 + 判定频率。

### B9 · `POST /pause` 的天数上限

- **现状**：契约写 `1-30` 天。
- **问题**：超过 30 天是否后端校验报错？还是前端直接限制 UI？
- **前端期望**：后端严格校验 + 前端 UI 限制，双重兜底。
- **需回复**：后端是否会拒绝 `days > 30` 并返回什么错误码。

---

## 三、需要后端新增 / 调整的接口（N 类）

> 这些是前端审计发现现有 API 无法支撑的体验需求，希望后端评估新增或调整。

### N1 · 首页状态机需要"撤销回复"能力

- **场景**：用户误触"今天还好 ✓"，设置页已有 `undoReply` action 定义（`useStore.ts:54-62`）但 UI 未暴露。
- **现有接口**：`DELETE /reply/today` 已实现。
- **问题**：撤销窗口期多长？（建议当天 23:59:59 前都可撤销）
- **需回复**：撤销窗口期 + 撤销后 `status` 变化（应为 `waiting` 或 `idle`，按当前时间判定）。

### N2 · 子女端"我守护的人"状态刷新机制

- **场景**：子女 App 在 dashboard 页面，希望每隔 N 秒自动刷新 ward 的状态（不需要手动下拉）。
- **现有接口**：`GET /guardian/wards` 和 `GET /guardian/wards/:id/dashboard` 都是 pull 模型。
- **问题**：是否需要后端提供 push 机制（WebSocket / SSE / APNs）？
- **前端期望**：Phase 1 先用 pull（30 秒轮询），Phase 2 再评估 push。
- **需回复**：是否同意 Phase 1 pull；是否有调用频率上限。

### N3 · 联系人短信验证码复用

- **场景**：settings/edit-contact 编辑已验证联系人手机号时，需要重新走短信验证。
- **现有接口**：`POST /contacts/:id/send-code` + `POST /contacts/:id/verify` 已存在。
- **问题**：更新手机号后原 `verified: true` 是否自动变 `false`？
- **前端期望**：自动变 `false`，强制重新验证。
- **需回复**：是 / 否。

### N4 · 守护暂停的恢复入口 API

- **场景**：前端设置页目前**没有"暂停守护"入口**（P1-5），需要在设置页增加"暂停守护"开关 + 天数选择器。
- **现有接口**：`POST /pause`、`POST /pause/resume`、`GET /pause/status` 都就绪。
- **问题**：首页 `status: 'paused'` 卡片点击"恢复守护"是否直接调 `POST /pause/resume`？
- **需回复**：是 / 否。

### N5 · 删除账号前的关联告知

- **场景**：删除账号确认页需要告知用户"你守护的 N 个人"和"守护你的 N 个人"，让用户知道影响范围。
- **现有接口**：`GET /auth/me` 返回 `guardianOf` / `wardOf`，但类型是 `any[]`。
- **问题**：能否明确这两个字段的结构？
- **前端期望**：
  ```ts
  guardianOf: Array<{ id: string; wardName: string; wardPhone: string }>;
  wardOf: Array<{ id: string; guardianName: string; guardianPhone: string }>;
  ```
- **需回复**：字段结构确认。

---

## 四、设计类决策（D 类）✅ 已拍板

> 2026-06-28 由用户直接决策完成，无需后端再评估，前端按以下结论实施。

### D1 · 首页告警态的"需要帮助"入口 ✅

**决策**：**不加**，首页 alert 状态只保留"今天还好 ✓"单按钮。
- 用户真需要帮助可走底部"紧急求助"入口，避免误触和告警流程复杂化。

### D2 · 紧急求助页地址来源优先级 ✅

**决策**：**自动用 GPS，失败时才回退到预设地址**。
- 减少用户选择负担；预设地址仅作为 GPS 兜底。

### D3 · 子女代付订阅的入口位置 ✅

**决策**：**复用 `GET /guardian/wards`，前端过滤 `isBound: true` 的条目**。
- 零后端成本；代付流程让用户从已绑定的 ward 列表中选择。

### D4 · 首页"消息推送未授权"提示的显示策略 ✅

**决策**：**`idle` / `replied` / `waiting` / `grace` 状态都显示，`alert` 不显示**。
- alert 是紧急场景不应被打断；waiting/grace 用户正在被提醒，更该授权。

### D5 · 看板页"本月平安 X/Y 天"的计算基准 ✅

**决策**：**分母用 `currentDay`（当前日期）**，不用 `daysInMonth`。
- 这样"本月平安 22/25 天"随日期递增，有成长感；月底时自然变为 X/30、X/31。
- 前端继续使用 `monthlyStats.repliedDays` + `new Date().getDate()` 组合。

---

## 五、后端工作量评估请求

为便于排期，请后端对以下工作给出预估工时（天）：

| 项 | 工作 | 预估 |
|----|------|------|
| B1-B9 | 契约确认回复 + 必要修订 | ? 天 |
| N1 | `DELETE /reply/today` 撤销窗口期确认 | ? 天 |
| N2 | 调用频率限制评估 | ? 天 |
| N3 | 更新手机号自动置 verified=false | ? 天 |
| N5 | `/auth/me` 中 `guardianOf`/`wardOf` 字段类型化 | ? 天 |
| D3 | 代付 ward 列表接口决策 | ? 天 |

---

## 六、对齐会议建议议题

建议 30 分钟同步会过一遍：

1. B1 + B2（暂停与回复的交互，最高优先级）
2. B5（删除账号级联，影响用户数据安全）
3. N1 + N4（撤销回复 + 暂停入口，影响 P1 工作）
4. D1 + D5（产品侧决策）

---

## 七、后端对齐后的前端排期（预览）

后端回复确认 → 前端按以下顺序推进：

| 批次 | 内容 | 预计 |
|------|------|------|
| 第 1 批 | P0-1/2/3/4（可独立做的） | 1 天 |
| 第 2 批 | P0-4 看板页真实数据 + P1-5 暂停守护 UI + P1-6 推送 token 上报 | 1.5 天（依赖 B1/B4/N4） |
| 第 3 批 | P1-8 undoReply 入口 + P2-9/10 图标替换 + P2-11/12 体验打磨 | 1 天（依赖 N1/N3） |
| 第 4 批 | S6 订阅付费全流程 | 2 天（依赖 B8/D3） |

**总计约 5.5 个工作日**，后端对齐后即可启动。

---

## 八、确认签字

- [ ] 后端已阅读 B1-B9 并逐项回复
- [ ] 后端已评估 N1-N5 可行性
- [ ] 产品侧已评估 D1-D5
- [ ] 双方确认撤销回复窗口期（N1）
- [ ] 双方确认删除账号级联策略（B5）
