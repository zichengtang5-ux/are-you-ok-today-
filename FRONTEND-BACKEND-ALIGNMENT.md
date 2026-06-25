# 前后端对齐文档 — S3~S7

> 维护者：小后（后端）+ 小前（前端）
> 最后更新：2026-06-25
> 状态：待双方确认后并行开发

---

## 一、已完成 & 待开发总览

| 阶段 | 状态 | 后端（小后） | 前端（小前） |
|------|------|-------------|-------------|
| S1 认证 | ✅ 完成 | 7 个 API | 待对接 |
| S2 联系人/提醒/回复 | ✅ 完成 | 11 个 API | 待对接 |
| S3 每日提醒引擎 | 🔲 待开发 | 定时任务 + APNs | iOS 本地通知 + 通知 Action |
| S4 超时告警 | 🔲 待开发 | 超时检测 + SMS告警 + 联系人确认 | 告警页面 + 联系人确认页 |
| S5 紧急求助 + 子女端 | 🔲 待开发 | 求助API + 子女关系API | 求助页 + 子女端页面 |
| S6 订阅付费 | 🔲 待开发 | Apple IAP校验 + 付费网关 | StoreKit集成 + 付费页 |
| S7 暂停/删除/收尾 | 🔲 待开发 | 暂停API + 数据删除API | 设置页完善 + 联调 |

---

## 二、职责分工（双方必读）

### 前端独占职责（后端不参与）

| 能力 | 技术方案 | 说明 |
|------|---------|------|
| iOS 本地通知 | `UNUserNotificationCenter` | 每日定时推送"今天还好吗？"，设备本地调度，不需要后端 |
| 通知内快捷回复 | Notification Actions | 通知横幅下拉显示"今天还好 ✓"按钮，点击后调 `POST /api/reply/today` |
| 通讯录导入 | `CNContactStore` (Contacts Framework) | 从系统通讯录导入联系人姓名+手机号 |
| GPS 定位 | `CLLocationManager` | 紧急求助时获取位置，使用时授权 |
| 电话拨打 | `tel://` URL scheme | 拨打 120、拨打联系人电话 |
| iOS 分享 | `UIActivityViewController` | 子女端发送邀请链接 |
| Apple IAP | StoreKit 2 | 付费订阅购买，拿到 receipt/transactionId 发给后端校验 |
| 首页状态机 | 根据 `GET /api/reply/status` 的 status 渲染不同卡片 | 6 种状态对应 6 种 UI |

### 后端独占职责（前端不参与）

| 能力 | 技术方案 | 说明 |
|------|---------|------|
| APNs 远程推送 | apnotic / node-apn | 关心式提醒（宽限期推送）、告警通知、子女端通知 |
| 超时检测定时任务 | Bull + Redis 或 node-cron | 窗口截止后检查数据库回复状态 |
| SMS 短信发送 | 阿里云 SMS API | 告警通知联系人 |
| 语音电话 | 阿里云语音通知 API | 付费用户告警双通道 |
| Apple IAP 校验 | App Store Server API | 校验 receipt，管理订阅状态 |
| 数据删除 | 级联删除所有关联数据 | 用户主动删除账号 |

### 需要协作的部分

| 事项 | 前端做什么 | 后端做什么 | 对齐点 |
|------|-----------|-----------|--------|
| 通知 Action 回复 | 点击通知按钮 → 调 `POST /api/reply/today` | 提供 API | 已对齐 ✅ |
| APNs device token | 注册远程通知 → 拿到 token → 调 API 上报 | 提供 `POST /api/device/register` | **待对齐** |
| 深链接 (Deep Link) | 处理 `todayok://` scheme → 路由到对应页面 | SMS 中包含深链接 | **待对齐** |
| StoreKit transaction | 购买成功 → 调 `POST /api/subscription/verify` | 校验 + 更新订阅状态 | **待对齐** |
| 联系人确认页 | 联系人打开深链接 → 显示确认页 → 调 API | 提供确认/求助 API | **待对齐** |

---

## 三、S3 API 契约 — 每日提醒引擎

### 新增接口

#### POST /api/device/register

上报 APNs device token（用于远程推送）

```
POST /api/device/register
```

请求：
```json
{
  "token": "APNs device token string",
  "platform": "ios"
}
```

响应：
```json
{ "message": "设备已注册" }
```

**前端时机**：用户授权通知权限后（引导第5步），注册远程通知，拿到 token 后调此接口。

---

### 前端本地通知逻辑

这部分**完全由前端实现**，后端不参与：

1. 用户设定提醒时间后（引导第4步完成），前端用 `UNUserNotificationCenter` 创建每日重复通知
2. 通知内容：标题 `"今天还好吗？"`，副标题 `"点一下告诉关心你的人你没事"`
3. 通知 Action：`"今天还好 ✓"` → 点击后调 `POST /api/reply/today`
4. 提醒时间修改时（`PATCH /api/reminder/config` 成功后），前端同步更新本地通知调度

### 后端定时任务逻辑

这部分**完全由后端实现**：

1. 每日扫描所有用户的提醒配置，窗口截止后检查是否已回复
2. 未回复 → 推送关心式提醒（APNs 远程推送）→ 30分钟宽限
3. 宽限后仍未回复 → 触发告警 → SMS 通知联系人

---

## 四、S4 API 契约 — 超时告警 & 联系人确认

### 新增接口

#### GET /api/alert/active

获取当前活跃告警（用户视角 — 自己的告警）

```
GET /api/alert/active
```

响应（无活跃告警）：
```json
null
```

响应（有活跃告警）：
```json
{
  "id": "alert-001",
  "triggeredAt": "2026-06-25T22:30:00Z",
  "lastReplyAt": "2026-06-24T20:15:00Z",
  "contactsNotified": [
    { "id": "c1", "name": "妈妈", "phone": "138****2222" }
  ],
  "smsRounds": 1,
  "timeline": [
    { "time": "22:00", "action": "发送了每日提醒" },
    { "time": "22:30", "action": "通知了紧急联系人", "isCurrent": true }
  ]
}
```

---

#### POST /api/alert/:alertId/confirm

联系人确认安全（"已联系，TA没事 ✓"）

```
POST /api/alert/:alertId/confirm
```

请求（联系人需要登录自己的账号）：
```json
{ "contactId": "c1" }
```

响应：
```json
{
  "message": "告警已解除",
  "alert": {
    "id": "alert-001",
    "status": "confirmed",
    "resolvedAt": "2026-06-25T22:42:00Z"
  }
}
```

---

#### POST /api/alert/:alertId/help

联系人需要帮助（"联系不上，需要帮助"）

```
POST /api/alert/:alertId/help
```

请求：
```json
{ "contactId": "c1" }
```

响应：
```json
{
  "message": "已记录",
  "alert": {
    "id": "alert-001",
    "status": "help_needed"
  },
  "suggestedActions": [
    { "type": "call_user", "label": "拨打用户电话", "phone": "138****5678" },
    { "type": "call_120", "label": "拨打 120", "phone": "120", "address": "北京市朝阳区xxx" },
    { "type": "call_contact", "label": "联系其他紧急联系人", "contacts": [] }
  ]
}
```

---

### 深链接 (Deep Link) 方案

**Scheme**: `todayok://`

| 深链接 | 前端路由 | 触发场景 |
|--------|---------|---------|
| `todayok://alert/:alertId` | 告警详情页 | SMS 中联系人点击 |
| `todayok://reply` | 首页回复 | 通知 Action（备选） |
| `todayok://invite/:inviteCode` | 邀请绑定页 | 子女端邀请链接 |
| `todayok://settings` | 设置页 | 推送通知引导 |

**前端需要**：
1. 在 `app.json` 中配置 scheme: `"todayok"`
2. 监听 deep link，路由到对应页面
3. 告警详情页支持两种操作：确认 / 需要帮助

**后端在 SMS 中包含**：
```
【今天还好】小李今天没有回复平安，最后回复时间：昨天 20:15，请及时联系确认。
打开App处理：todayok://alert/xxx
```

---

## 五、S5 API 契约 — 紧急求助 + 子女端

### 紧急求助（2 个接口）

#### POST /api/help/emergency

触发紧急求助

```
POST /api/help/emergency
```

请求：
```json
{
  "latitude": 39.9042,
  "longitude": 116.4074,
  "addressText": "北京市朝阳区xxx"
}
```

- `latitude/longitude` 选填（GPS 获取失败时不传）
- `addressText` 选填（GPS 失败时用用户预设住址）

响应：
```json
{
  "id": "help-001",
  "createdAt": "2026-06-25T23:00:00Z",
  "address": "北京市朝阳区xxx",
  "contactsNotified": [
    { "id": "c1", "name": "妈妈", "phone": "13811112222" }
  ],
  "message": "已通知所有紧急联系人"
}
```

---

#### GET /api/help/address

获取当前地址（用于紧急求助页展示）

```
GET /api/help/address
```

响应：
```json
{
  "address": "北京市朝阳区xxx",
  "source": "user_preset"
}
```

- `source`: `"gps"` 或 `"user_preset"`
- 前端优先用 GPS 实时定位，失败时用此接口返回的预设住址

---

### 子女端（5 个接口）

#### POST /api/guardian/create

创建守护档案（子女为父母）

```
POST /api/guardian/create
```

请求：
```json
{
  "wardName": "妈妈",
  "wardPhone": "13811112222",
  "relation": "子女"
}
```

响应：
```json
{
  "id": "gr-001",
  "inviteCode": "ABC123XYZ",
  "inviteLink": "todayok://invite/ABC123XYZ",
  "isBound": false,
  "wardName": "妈妈",
  "wardPhone": "13811112222"
}
```

- 前端用 `UIActivityViewController` 分享 `inviteLink` + App Store 下载链接

---

#### POST /api/guardian/accept-invite

接受邀请（父母端）

```
POST /api/guardian/accept-invite
```

请求：
```json
{ "inviteCode": "ABC123XYZ" }
```

响应：
```json
{
  "message": "绑定成功",
  "guardian": { "id": "gr-001", "guardianName": "小张" }
}
```

---

#### GET /api/guardian/wards

获取我守护的人列表

```
GET /api/guardian/wards
```

响应：
```json
[
  {
    "id": "gr-001",
    "wardName": "妈妈",
    "wardPhone": "138****2222",
    "relation": "子女",
    "isBound": true,
    "status": "replied",
    "lastReplyAt": "2026-06-25T12:00:00Z",
    "reminderConfig": { "startTime": "19:00", "endTime": "21:00" }
  }
]
```

---

#### GET /api/guardian/wards/:id/dashboard

关怀看板（付费解锁）

```
GET /api/guardian/wards/:id/dashboard
```

响应：
```json
{
  "wardName": "妈妈",
  "status": "replied",
  "lastReplyAt": "2026-06-25T12:00:00Z",
  "recentDays": [
    { "date": "2026-06-25", "replied": true },
    { "date": "2026-06-24", "replied": true },
    { "date": "2026-06-23", "replied": false }
  ],
  "monthlyStats": {
    "repliedDays": 22,
    "totalDays": 25,
    "display": "本月平安 22/25 天"
  },
  "history": [
    { "date": "2026-06-23", "event": "妈妈未回复，你代确认了'TA没事'" }
  ]
}
```

- 免费用户：只返回 `status` + `lastReplyAt`，其余字段返回 `null` + 付费引导
- 付费用户：返回完整数据

---

#### POST /api/guardian/wards/:id/proxy-reply

子女代确认（"TA没事"）

```
POST /api/guardian/wards/:id/proxy-reply
```

响应：
```json
{
  "message": "已代确认",
  "guardStatus": "replied"
}
```

---

## 六、S6 API 契约 — 订阅付费

### 新增接口（2 个）

#### POST /api/subscription/verify

校验 Apple IAP 交易

```
POST /api/subscription/verify
```

请求：
```json
{
  "transactionId": "Apple transaction ID",
  "plan": "monthly"
}
```

- `plan`: `"monthly"` | `"yearly"`

响应：
```json
{
  "subscription": {
    "plan": "monthly",
    "status": "active",
    "currentPeriodEnd": "2026-07-25T00:00:00Z"
  }
}
```

---

#### POST /api/subscription/proxy-subscribe

子女代付

```
POST /api/subscription/proxy-subscribe
```

请求：
```json
{
  "wardId": "父母用户ID",
  "transactionId": "Apple transaction ID",
  "plan": "yearly"
}
```

响应：
```json
{
  "message": "已为妈妈开通守护版",
  "subscription": { "plan": "yearly", "status": "active" }
}
```

---

### 前端 StoreKit 流程

1. 用户在付费页选择方案（月付 0.9 / 年付 9.9）
2. 前端调 StoreKit 2 发起购买
3. 购买成功后拿到 `transactionId`
4. 调 `POST /api/subscription/verify` 校验
5. 后端调 App Store Server API 验证 → 更新订阅状态
6. 前端刷新 `GET /api/auth/me` 获取最新付费状态

### 付费功能网关

后端在以下接口中检查付费状态：
- 联系人数量限制（免费 1 / 付费 5）— 已实现 ✅
- 关怀看板完整数据 — S5 实现
- 告警通知语音电话 — S4 实现

前端根据 `user.isPremium`（或 `subscription.status`）控制 UI 展示。

---

## 七、S7 API 契约 — 暂停守护 + 数据删除

### 新增接口（4 个）

#### POST /api/pause

暂停守护

```
POST /api/pause
```

请求：
```json
{
  "days": 7,
  "reason": "出差"
}
```

- `days`: 1/3/7/自定义(1-30)
- `reason` 选填

响应：
```json
{
  "message": "守护已暂停",
  "pauseEndAt": "2026-07-02T00:00:00Z",
  "days": 7
}
```

---

#### POST /api/pause/resume

提前恢复守护

```
POST /api/pause/resume
```

响应：
```json
{
  "message": "守护已恢复",
  "guardStatus": "idle"
}
```

---

#### GET /api/pause/status

获取暂停状态

```
GET /api/pause/status
```

响应（未暂停）：
```json
{ "isPaused": false }
```

响应（已暂停）：
```json
{
  "isPaused": true,
  "pauseEndAt": "2026-07-02T00:00:00Z",
  "daysRemaining": 5,
  "reason": "出差"
}
```

---

#### DELETE /api/user/account

删除账号和所有数据

```
DELETE /api/user/account
```

请求：
```json
{
  "confirmation": "确认删除"
}
```

- 必须传 `confirmation: "确认删除"` 才能执行
- 删除后 token 失效，所有数据不可恢复

响应：
```json
{
  "message": "账号已删除，你的紧急联系人将不再收到通知"
}
```

---

## 八、完整 API 汇总（S1~S7，共 36 个接口）

| # | 方法 | 路径 | 阶段 | 说明 |
|---|------|------|------|------|
| 1 | POST | `/api/auth/send-code` | S1 | 发送登录验证码 |
| 2 | POST | `/api/auth/verify-code` | S1 | 验证码登录 |
| 3 | POST | `/api/auth/refresh` | S1 | 刷新 token |
| 4 | GET | `/api/auth/me` | S1 | 获取完整用户信息 |
| 5 | GET | `/api/user/profile` | S1 | 获取基本资料 |
| 6 | PATCH | `/api/user/profile` | S1 | 更新资料 |
| 7 | PATCH | `/api/user/onboarding` | S1 | 更新引导进度 |
| 8 | GET | `/api/contacts` | S2 | 联系人列表 |
| 9 | POST | `/api/contacts` | S2 | 创建联系人 |
| 10 | PATCH | `/api/contacts/:id` | S2 | 更新联系人 |
| 11 | DELETE | `/api/contacts/:id` | S2 | 删除联系人 |
| 12 | POST | `/api/contacts/:id/send-code` | S2 | 发送联系人验证短信 |
| 13 | POST | `/api/contacts/:id/verify` | S2 | 验证联系人手机号 |
| 14 | GET | `/api/reminder/config` | S2 | 获取提醒配置 |
| 15 | PATCH | `/api/reminder/config` | S2 | 更新提醒配置 |
| 16 | POST | `/api/reply/today` | S2 | 今日回复 |
| 17 | DELETE | `/api/reply/today` | S2 | 撤回今日回复 |
| 18 | GET | `/api/reply/status` | S2 | 获取守护状态 |
| 19 | POST | `/api/device/register` | S3 | 上报 APNs token |
| 20 | GET | `/api/alert/active` | S4 | 获取活跃告警 |
| 21 | POST | `/api/alert/:id/confirm` | S4 | 联系人确认安全 |
| 22 | POST | `/api/alert/:id/help` | S4 | 联系人需要帮助 |
| 23 | POST | `/api/help/emergency` | S5 | 触发紧急求助 |
| 24 | GET | `/api/help/address` | S5 | 获取当前地址 |
| 25 | POST | `/api/guardian/create` | S5 | 创建守护档案 |
| 26 | POST | `/api/guardian/accept-invite` | S5 | 接受邀请 |
| 27 | GET | `/api/guardian/wards` | S5 | 守护列表 |
| 28 | GET | `/api/guardian/wards/:id/dashboard` | S5 | 关怀看板 |
| 29 | POST | `/api/guardian/wards/:id/proxy-reply` | S5 | 子女代确认 |
| 30 | POST | `/api/subscription/verify` | S6 | IAP 交易校验 |
| 31 | POST | `/api/subscription/proxy-subscribe` | S6 | 子女代付 |
| 32 | POST | `/api/pause` | S7 | 暂停守护 |
| 33 | POST | `/api/pause/resume` | S7 | 提前恢复 |
| 34 | GET | `/api/pause/status` | S7 | 暂停状态 |
| 35 | DELETE | `/api/user/account` | S7 | 删除账号 |

---

## 九、前端可先行开发的部分（不依赖后端）

以下功能前端可以先做，不需要等后端接口：

1. **iOS 本地通知**：引导第5步注册通知 → 创建每日重复通知 + Notification Action
2. **首页状态机 UI**：6 种状态卡片（先用 mock 数据，后替换 API）
3. **通讯录导入**：引导第3步从 CNContactStore 导入联系人
4. **深链接路由**：配置 `todayok://` scheme + 路由处理
5. **StoreKit 2 集成**：付费页 UI + StoreKit 购买流程
6. **GPS 定位**：紧急求助页位置获取
7. **电话拨打**：`tel://` 拨打 120 和联系人
8. **iOS 分享**：子女端 `UIActivityViewController`
9. **设置页全部 UI**：含暂停守护选择器、删除账号二次确认

---

## 十、约定 & 规范

### 错误响应格式

```json
{
  "statusCode": 400,
  "message": "具体错误描述",
  "error": "Bad Request"
}
```

### 日期时间格式

- 统一使用 ISO 8601：`2026-06-25T22:30:00Z`（UTC）
- 前端根据用户时区转换显示

### 手机号脱敏

- 后端在列表接口中返回完整手机号
- 前端展示时脱敏：`138****5678`

### 推送文案（前端本地通知）

| 场景 | 标题 | 内容 | Action 按钮 |
|------|------|------|------------|
| 每日提醒 | 今天还好吗？ | 点一下告诉关心你的人你没事 | 今天还好 ✓ |
| 已回复反馈 | 收到，安心了 | 已收到你的平安 | — |

### 推送文案（后端 APNs 远程推送）

| 场景 | 标题 | 内容 |
|------|------|------|
| 关心式提醒 | 没收到你的回应 | 有点担心，看到消息回一下？ |
| 告警通知（联系人）| [用户昵称] 今天没有回复平安 | 最后回复时间：XXX，请及时联系确认 |
| 子女通知 | 妈妈今天还没回复 | 你可以打电话确认或代确认"TA没事" |
| 暂停恢复 | 欢迎回来 | 守护已恢复，今晚 X 点会收到提醒 |

---

## 十一、双方确认签字

- [ ] 小前：已阅读并确认全部 API 契约
- [ ] 小后：已阅读并确认全部 API 契约
- [ ] 双方确认深链接 scheme: `todayok://`
- [ ] 双方确认推送文案内容
