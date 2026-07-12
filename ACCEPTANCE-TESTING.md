# 验收测试指南

适用于本地模拟器、真机开发构建、EAS internal build 的人工验收。

## 环境准备

### 后端

需要 PostgreSQL + Redis。

```bash
cd server
cp .env.example .env
docker compose up -d --build
```

或本机已有 PostgreSQL / Redis 时：

```bash
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

Swagger：`http://localhost:3000/api/docs`

开发环境下：

- `SMS_PROVIDER=mock` 时验证码和短信只写日志
- `VOICE_PROVIDER=mock` 时语音电话只写日志
- `APNS_PROVIDER=mock` 时推送只写日志
- `NODE_ENV=development` 时 IAP 使用开发降级逻辑

### 前端

```bash
cd app
cp .env.example .env
npm install
npx expo start
```

模拟器可以使用：

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

真机必须使用 Mac 局域网 IP 或公网 HTTPS 后端：

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
```

## 验收主流程

### 1. 登录与引导

1. 打开 App，进入登录页。
2. 输入 11 位手机号，获取验证码。
3. 从后端日志读取 mock 验证码，完成登录。
4. 完成协议确认、基本信息、地址定位/填写、联系人、提醒时间、通知授权。
5. 在每个引导步骤点击返回，确认回到上一页且已填写内容仍然保留。
6. 引导完成后进入首页。

通过标准：

- 用户可登录
- `auth/me` 返回当前用户
- 首页显示正确守护状态
- 本地 token 可持久化，重启后仍能恢复登录态
- 地址页可手动填写，也可授权定位后填充地址
- 紧急联系人不需要填写联系人验证码
- 提醒时间页可滚动选择开始/结束整点；开始与结束不能相同
- 支持跨日窗口，例如 `23:00 - 次日 01:00`，跨日零点后的签到归属前一天守护周期
- 免费版最多 1 位联系人，守护版最多 5 位；联系人可添加、编辑和删除
- 至少保留 1 位紧急联系人，删除最后一位时应显示明确说明

### 2. 每日确认

1. 首页点击“我很好”。
2. 状态变为已确认。
3. 执行撤销确认。
4. 刷新或重启 App。

通过标准：

- 后端创建或更新 `DailyRecord`
- `GuardStatus.status` 变为 `replied`
- 撤销后状态回到 `waiting`
- `GET /api/reply/streak` 返回连续确认天数
- 首页保持已确认状态

### 3. 宽限期与告警

1. 将提醒结束时间设为当前时间之前。
2. 等待 reminder cron 扫描，或在测试环境中触发到期检查。
3. 用户未回复时进入 `grace`。
4. 宽限期后进入 `alert`。

通过标准：

- `grace` 时发送关怀提醒
- `alert` 时创建 `AlertEvent`
- 通知任务进入 BullMQ
- mock SMS / voice / APNs 日志可见
- 前端通过 SSE 或刷新拿到状态变化

### 4. 告警联系人处理

1. 通过短信链接或测试深链打开告警联系人页。
2. 选择“确认安全”。
3. 重新触发告警后选择“需要帮助”。
4. 在求助建议页尝试拨打用户、120 或其他联系人。

通过标准：

- `GET /api/alert/:id?contactId=...` 返回指定告警
- `AlertAction` 被记录
- 确认安全后 `AlertEvent.status=confirmed`，首页状态同步为已确认
- 需要帮助后 `AlertEvent.status=help_needed`，页面展示拨打用户、120、其他联系人建议
- 模拟器无法拨号时显示普通提示，不出现红屏

### 5. 暂停与恢复

1. 在设置页选择暂停 1、3 或 7 天。
2. 首页状态变为 `paused`。
3. 执行恢复。

通过标准：

- 暂停期内 reminder cron 不触发告警
- 恢复后状态回到可继续提醒的状态
- 设置页可看到暂停截止日期和恢复按钮

### 6. 删除账号

1. 进入设置页。
2. 点击删除账号。
3. 输入确认文本并提交。

通过标准：

- 后端执行 `DELETE /api/user/account`
- 本地 `access_token`、`refresh_token` 被清除
- Zustand 状态重置
- App 返回登录页
- 开发模拟模式即使后端未启动，也能清理本地模拟账号并返回登录页

### 7. 订阅

开发环境先验收 UI 与后端状态：

1. 进入订阅页。
2. 选择月付或年付。

上线前必须补充真实 StoreKit sandbox 验收：

- App Store Connect 订阅产品已创建
- sandbox Apple ID 可购买
- 后端 `POST /api/subscription/verify` 校验通过
- `GET /api/subscription/status` 返回 active

### 8. 紧急求助

1. 进入紧急求助页。
2. 授权定位，确认页面自动显示大概位置和定位精度。
3. 修改大概位置，并补充楼栋、门牌或房间号。
4. 点击红色圆形 SOS 提交求助。

通过标准：

- 页面以红色为主色，圆形 SOS 位于精简地址模块上方
- 有定位权限时提交经纬度
- 定位失败时可回退保存地址
- 地址可编辑，并将补充地址合并发送
- 页面不显示 110 / 120 快捷拨号入口
- 后端创建 `HelpRequest`
- 联系人收到 mock 通知日志

## 2026-07-03 模拟器回归记录

环境：iPhone 16 Pro / iOS 18.6，Expo Go，后端连接本机 PostgreSQL 16 + Redis，通知、短信、语音、IAP 均使用 mock provider。

已覆盖：

- 手机号验证码登录、协议勾选、基本信息、地址定位入口、联系人免验证码、提醒时间、通知授权
- 首页每日签到、连续天数更新、撤销签到
- 人工构造 `waiting`、`alert` 状态后的首页和告警页展示
- 告警联系人确认安全，告警解除并同步首页状态
- 告警联系人选择需要帮助，进入行动建议页
- SOS 主动求助，mock 短信发送给联系人
- mock 月付订阅购买、订阅成功页、设置页订阅态展示
- 设置页暂停 1 天、恢复提醒
- 提醒时间整点滚动选择
- 电话链接在模拟器不可拨号时的错误兜底

限制：

- Expo Go 不接管项目自定义 `todayok://` scheme；模拟器使用 `exp://.../--/alert/contact?...` 验证页面和参数。生产前必须用 EAS dev/internal build 在真机验证 `todayok://alert/...`。
- StoreKit 真实购买、APNs 真机 token、短信/语音真实送达仍需 Apple Developer Program、App Store Connect、APNs、阿里云模板配置完成后验证。

## 自动化检查

提交前至少跑：

```bash
cd app
npx tsc --noEmit
npm test -- --runInBand
npm run lint

cd ../server
npm run prisma:generate
npm test -- --runInBand
npm run build
```

有 PostgreSQL + Redis 时再跑：

```bash
cd server
npm run test:integration
```

## 上线前真机重点

- APNs token 是否能成功上报
- 真机定位授权与地址回退
- 深链 `todayok://` 是否能打开邀请和告警联系人页
- SSE 在锁屏/切后台/恢复后是否能重连
- StoreKit sandbox 购买、恢复购买、过期降级
- 删除账号后再次登录是否是干净状态
