# 后端对齐完成 — 给前端的消息

> 日期：2026-06-28
> PR: https://github.com/zichengtang5-ux/are-you-ok-today-/pull/16
> 关联文档：BACKEND-ALIGNMENT-REPLY.md

---

## 一句话总结

后端 4 个 bug 已修复 + 5 项契约变更已落地，**全部有代码改动和测试**。PR #16 已提，review 后合入即可开始第 2 批前端工作。

---

## 你需要知道的 6 个行为变化

### 1. `GET /reply/status` 暂停过期会自动恢复（BUG-1）

之前：暂停到期后如果没人调 `/pause/status`，status 会一直卡在 `'paused'`。

现在：`/reply/status` 内部会检查暂停是否过期，过期后自动恢复为 `'idle'`。**你不需要额外调 `/pause/status` 来触发恢复**。

### 2. `POST /reply/today` 暂停期间会返回 409（B2）

之前：暂停期间回复会静默成功，覆盖掉 paused 状态。

现在：返回 `409 Conflict`，响应体：
```json
{ "statusCode": 409, "message": "守护已暂停，请先恢复守护", "error": "Conflict" }
```

**前端需要**：`api.ts` 的响应拦截器里处理 409，或在该调用的 catch 里判断，引导用户先点"恢复守护"。

### 3. 新增 `GET /api/alert/active`（B3）

新接口，返回当前活跃告警详情：
```json
{
  "id": "alert-001",
  "triggeredAt": "2026-06-25T22:30:00Z",
  "lastReplyAt": "2026-06-24T20:15:00Z",
  "contactsNotified": [{ "id": "c1", "name": "妈妈", "phone": "138****2222" }],
  "timeline": [{ "time": "22:00", "action": "发送了每日提醒" }, ...]
}
```
无活跃告警时返回 `null`（HTTP 200）。**不含 `smsRounds` 字段**。

**前端需要**：`api.types.ts` 补充类型定义，首页 `alert` 状态卡片可以用这个接口拉取告警详情展示。

### 4. `DELETE /reply/today` 撤销后状态按时间判定（N1）

之前：撤销后统一返回 `status: 'waiting'`。

现在：
- 当前时间 < 提醒窗口结束时间 → `status: 'waiting'`
- 当前时间 >= 提醒窗口结束时间 → `status: 'grace'`（并且会自动创建新的活跃告警）

**前端需要**：撤销后刷新 `/reply/status`，按返回的新 status 切换首页状态即可。

### 5. 设备注册改为单设备模式（BUG-3）

之前：换手机后旧设备仍会收到推送。

现在：每次 `POST /device/register` 会自动删除旧 token。**你不需要改任何代码**，只要保持现有的"启动时 + token 变化时调注册接口"逻辑即可。

### 6. `POST /guardian/wards/:id/proxy-reply` 新增 isBound 校验（B6）

之前：未绑定的邀请关系也能代确认。

现在：`isBound === false` 时返回 `403 Forbidden`。**前端正常流程不会触发这个问题**（未绑定的 ward 不会出现在代确认入口），但保险起见 catch 里加个处理。

---

## 不需要改动的部分

| 项 | 说明 |
|----|------|
| B7 | dashboard 免费用户字段确认返回 `null`（不是缺失），你的类型定义没问题 |
| B8 | 订阅过期是实时判定的，dashboard 立即降级，不需要轮询 |
| B9 | 暂停天数后端严格校验 1-30，你 UI 限制就够了 |
| N2 | 子女端 30 秒轮询方案确认，后端无频率限制 |
| N3 | 更新联系人手机号自动置 `verified=false`，已实现 |
| N4 | 首页 paused 卡片"恢复守护"直接调 `POST /pause/resume`，确认 |
| D3 | 代付复用 `GET /guardian/wards` 过滤 `isBound: true`，不需要新接口 |

---

## 你的 api.types.ts 需要补充

```typescript
// 新增 — GET /api/alert/active
interface ActiveAlertResponse {
  id: string;
  triggeredAt: string;
  lastReplyAt: string | null;
  contactsNotified: Array<{ id: string; name: string; phone: string }>;
  timeline: Array<{ time: string; action: string; isCurrent?: boolean }>;
}
// 返回 null | ActiveAlertResponse

// 已有但确认 — DELETE /reply/today
// 现在 guardStatus 可能是 'waiting' | 'grace'（之前只有 'waiting'）
interface UndoReplyResponse {
  message: string;
  guardStatus: 'waiting' | 'grace';
}

// 已有但确认 — POST /reply/today 错误处理
// 新增 409 Conflict 情况
// { statusCode: 409, message: "守护已暂停，请先恢复守护", error: "Conflict" }
```

---

## 建议的前端推进顺序

1. **先合 PR #16** → 后端测试通过后可立即 merge
2. **第 1 批**（1 天）：P0-1 TabBar、P0-2 Token 刷新跳转、P0-3 删除账号调真实 API（你已有代码，确认走 `DELETE /user/account` 即可）
3. **第 2 批**（1.5 天）：首页接入 `GET /alert/active` 展示告警详情、暂停守护 UI 完善、推送 token 上报确认
4. **第 3 批**（1 天）：撤销回复入口 + 处理 409 暂停冲突
5. **第 4 批**（2 天）：S6 订阅付费全流程联调

有任何接口问题随时找我。
