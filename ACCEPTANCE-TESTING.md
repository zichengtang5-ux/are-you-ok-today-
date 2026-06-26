# 今天还好 - 产品验收测试指南

> 协调员专用：在本机 Mac + iOS 模拟器（或真机）上跑通完整用户流程。

## 一、环境准备

### 1. 后端（已在运行）
后端 NestJS 服务运行在 `http://localhost:3000`，SQLite + Mock 短信 / Mock APNs / Mock IAP。

如需重启：
```bash
cd server
npm run start:dev
```

> Mock 模式下 `send-code` 返回的 JSON 包含 `mockCode` 字段，即真实验证码，直接用即可。

日志：`/tmp/today-ok-server.log`

### 2. 前端（Expo SDK 56）
```bash
cd app
npm start         # 启动 Expo Dev Server
```
启动后会出现二维码，三种运行方式任选其一：

| 方式 | 命令 | 说明 |
|------|------|------|
| iOS 模拟器（推荐） | 在 Expo 终端按 `i` | 自动启动 iPhone 16，localhost 可直通后端 |
| 真机 Expo Go | 手机扫码 | **需改 API 地址**（见下方） |
| 真机开发构建 | `npx expo run:ios` | 需 Xcode + Apple 开发者账号 |

### 3. 真机测试时的 API 地址修改
`app/src/services/api.ts` 第 4 行当前为 `http://localhost:3000/api`。
真机测试请临时改成 Mac 局域网 IP：

```ts
const API_BASE_URL = 'http://10.78.46.115:3000/api';
```

> 当前 Mac IP: `10.78.46.115`（以 `ifconfig` 为准）

---

## 二、完整用户流程（验收路径）

按下面 12 步走完所有 S1–S7 功能，每一步对应一个需求模块。

### ✅ S1 注册登录

1. **App 启动** → 进入登录页 `/onboarding/login`
2. 输入任意 11 位手机号（如 `13800001111`）→ 点「获取验证码」
   - 后端日志会打印 `mockCode=XXXXXX`，或查看 `server/prisma/dev.db` 的 VerificationCode 表
3. 输入验证码 → 完成登录

### ✅ S2 引导流程（5 步）

依次完成：
1. **协议同意** → 点「同意并继续」
2. **基础信息** → 填昵称、年龄段
3. **紧急联系人** → 添加至少 1 位（姓名 + 手机号）
4. **提醒时间** → 选开始/结束时间（如 08:00 – 22:00）
5. **通知权限** → 点「开启通知」（iOS 会弹权限对话框，选允许）

完成后自动跳首页。

### ✅ S3 每日打卡（首页）

- 首页显示「今天还好吗？」卡片
- 点「我很好」 → 卡片变绿，今日已确认
- 后端日志可看到 `DailyRecord` 创建、`GuardStatus` 更新

### ✅ S4 提醒引擎（自动）

- 后端 `reminder-cron.service` 每分钟扫描一次
- 当到达结束时间 + 宽限期仍未回复 → 自动：
  - 发送 Mock APNs 推送（日志 `PushService: sendCareReminder`）
  - 宽限期过后发 Mock 短信给紧急联系人（日志 `SmsService: sendAlert`）

> 要快速触发，可临时把 `reminder.endTime` 改到当前时间前，或手动调用 `POST /api/reply` 后再等待下一轮 cron。

### ✅ S5 紧急求助 + 守护中心

- 首页/Tab 进入「紧急求助」页：
  - 显示当前定位（模拟器：Features → Location → 自选坐标）
  - 点「拨打 120」→ 模拟器拨号
  - 点「联系 XXX」→ 拨打紧急联系人
- 设置页 → 「守护中心 →」进入子女端页面：
  - 创建守护关系（输入被守护人手机号，不同于自己）
  - 生成 8 位邀请码
  - 模拟子女端：退出登录 → 用另一手机号登录 → 输入邀请码接受

### ✅ S6 订阅（IAP Mock）

- 设置页 → 「升级守护版」进入订阅页
- Mock 模式下点「立即订阅」→ 直接成功（NODE_ENV=development 自动 mock）
- 状态变成「守护版 · 月付/年付」

### ✅ S7 暂停 / 删除账号

- 设置页 → 「暂停守护」→ 选天数（1/3/7 天或自定义）
  - 暂停期间不打提醒、不判定异常
  - 支持「提前恢复」
- 设置页 → 「删除我的数据」→ 输入「确认删除」→ 所有数据清空
- 设置页 → 「删除账号」→ 级联删除（后端 `UserController.deleteAccount`）

---

## 三、常用调试命令

```bash
# 重置数据库
rm server/prisma/dev.db && cd server && npx prisma migrate deploy

# 查看数据表
cd server && npx prisma studio    # 打开 http://localhost:5555

# 查看后端日志
tail -f /tmp/today-ok-server.log

# 手动调接口
curl -X POST http://localhost:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800001111"}'
```

---

## 四、验收检查清单

| # | 检查项 | 期望 |
|---|--------|------|
| 1 | 首次启动进登录页 | ✅ |
| 2 | 验证码 60s 冷却 | ✅ |
| 3 | 引导 5 步完整走完 | ✅ |
| 4 | 首页 6 种状态机切换正常 | ✅ 默认/已确认/超时预警/异常/暂停/求助 |
| 5 | 通知权限已请求 | ✅ |
| 6 | 通讯录导入能用（iOS） | ✅ |
| 7 | 提醒窗口结束后收到推送（Mock 日志可见） | ✅ |
| 8 | 宽限期过后紧急联系人收到短信（Mock） | ✅ |
| 9 | 紧急求助页能拨号 | ✅ |
| 10 | 守护关系能建立（邀请码 8 位） | ✅ |
| 11 | 订阅 Mock 下单成功 | ✅ |
| 12 | 暂停守护生效 | ✅ |
| 13 | 删除账号级联清除 | ✅ |

---

## 五、常见问题

**Q: 模拟器无法访问 localhost?**
A: 正常 iOS 模拟器的 localhost 指向 Mac，应能直连。如不行改用 Mac 局域网 IP。

**Q: 收不到通知？**
A: 后端用 Mock APNs，仅打印日志，不弹 iOS 通知。验收时看 `server.log` 的 `PushService` 输出即可。

**Q: StoreKit 订阅不生效？**
A: `NODE_ENV=development` 下 IAP 自动走 mock，不会触发真实 Apple 支付。

**Q: 想重头再测一遍？**
A: 删数据库 + App 数据：
```bash
rm server/prisma/dev.db
cd server && npx prisma migrate deploy
# 模拟器：Device → Erase All Content and Settings
```
