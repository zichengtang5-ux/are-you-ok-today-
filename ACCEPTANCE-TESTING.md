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
4. 完成协议确认、基本信息、联系人、提醒时间、通知授权。
5. 引导完成后进入首页。

通过标准：

- 用户可登录
- `auth/me` 返回当前用户
- 首页显示正确守护状态
- 本地 token 可持久化，重启后仍能恢复登录态

### 2. 每日确认

1. 首页点击“我很好”。
2. 状态变为已确认。
3. 刷新或重启 App。

通过标准：

- 后端创建或更新 `DailyRecord`
- `GuardStatus.status` 变为 `replied`
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

当前状态：前端已声明联系人处理接口，但后端尚未实现 `/api/alert/:id/confirm` 和 `/api/alert/:id/help`。这项是 P0 契约缺口，补齐前只能验收告警生成和 `/api/alert/active` 展示。

1. 打开告警联系人链接或告警处理页。
2. 选择“确认安全”。
3. 重新触发告警后选择“需要帮助”。

通过标准：

- 后端已补齐对应接口
- `AlertAction` 被记录
- `AlertEvent.status` 正确流转
- 首页告警态展示对应结果

### 5. 子女守护

1. 用户 A 创建守护邀请。
2. 用户 B 用邀请码绑定。
3. 用户 B 查看守护列表和看板。
4. 用户 B 代确认。

通过标准：

- `GuardianRelation.isBound=true`
- 守护列表展示被守护人
- 看板显示可用统计
- 代确认成功后被守护人状态同步更新

### 6. 暂停与恢复

1. 在设置页暂停守护。
2. 首页状态变为 `paused`。
3. 执行恢复。

通过标准：

- 暂停期内 reminder cron 不触发告警
- 恢复后状态回到可继续守护的状态

### 7. 删除账号

1. 进入设置页。
2. 点击删除账号。
3. 输入确认文本并提交。

通过标准：

- 后端执行 `DELETE /api/user/account`
- 本地 `access_token`、`refresh_token` 被清除
- Zustand 状态重置
- App 返回登录页

### 8. 订阅

开发环境先验收 UI 与后端状态：

1. 进入订阅页。
2. 选择月付或年付。
3. 子女端进入代付订阅页。

上线前必须补充真实 StoreKit sandbox 验收：

- App Store Connect 订阅产品已创建
- sandbox Apple ID 可购买
- 后端 `POST /api/subscription/verify` 校验通过
- `GET /api/subscription/status` 返回 active

### 9. 紧急求助

1. 进入紧急求助页。
2. 授权定位。
3. 提交求助。

通过标准：

- 有定位权限时提交经纬度
- 定位失败时可回退保存地址
- 后端创建 `HelpRequest`
- 联系人收到 mock 通知日志

## 自动化检查

提交前至少跑：

```bash
cd app
npx tsc --noEmit
npm test -- --runInBand
npm run lint

cd ../server
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
- 深链 `todayok://` 是否能打开邀请
- SSE 在锁屏/切后台/恢复后是否能重连
- StoreKit sandbox 购买、恢复购买、过期降级
- 删除账号后再次登录是否是干净状态
