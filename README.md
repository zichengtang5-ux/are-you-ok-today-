# 今天还好 · are you ok today

面向独居人群的安全守护 App：用户每天确认一次"平安"，若在设定时段结束后仍未确认，系统会在宽限期后自动通过短信 / 语音电话 / 推送通知其紧急联系人与子女。

- **前端**：Expo (React Native) + Expo Router，主打 iOS，App Store 分发
- **后端**：NestJS + Prisma + PostgreSQL + Redis + BullMQ
- **商业模式**：子女代付订阅（守护版），Apple IAP

---

## 目录结构

```
.
├── app/                  # 前端（Expo / React Native）
│   ├── src/app/          #   Expo Router 文件路由（onboarding / tabs / alert / guardian / subscription / help）
│   ├── src/store/        #   Zustand 状态（含 persist）
│   ├── src/services/     #   api / 通知 / IAP / 深链 / 实时(SSE) / 时区 / 错误上报
│   └── src/components/   #   UI 组件 + 主题
├── server/               # 后端（NestJS）
│   ├── src/reminder/     #   提醒触发引擎（按 nextDueAt 索引扫描 + 分片）
│   ├── src/notification/ #   BullMQ 异步通知投递（重试 / 死信 / 回执）
│   ├── src/events/       #   SSE + Redis pub/sub 实时通道
│   ├── src/auth|user|contact|guardian|subscription|pause|help/  # 业务模块
│   ├── src/common/       #   守卫 / 装饰器 / Redis 限流
│   └── prisma/           #   schema + migrations（PostgreSQL）
└── docs（根目录）        # 产品 PRD、竞品研究、原型、验收、状态总览
```

## 核心链路

1. **提醒调度**：`ReminderConfig.nextDueAt` 建索引，cron 每分钟只扫「到期」记录（负载与到期用户数成正比，而非总用户数），支持多实例分片 + 时区感知。
2. **状态机**：`idle → grace → alert`；用户回复则 `replied`。
3. **告警投递**：进入 alert 后，通知任务入 BullMQ，独立 worker 投递短信/语音，带重试 + 死信 + 送达回执，不阻塞调度。
4. **实时同步**：状态变化经 Redis pub/sub 广播，前端通过 SSE (`/api/events/stream`) 实时接收，替代轮询。

## 快速开始

### 后端

```bash
cd server
cp .env.example .env          # 配置 DATABASE_URL / REDIS_* / JWT_SECRET 等
docker compose up -d          # 起 api + postgres + redis
# 或本地开发：
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

API 文档：`http://localhost:3000/api/docs`

### 前端

```bash
cd app
npm install
npx expo start                # 按提示在 iOS 模拟器 / Expo Go 打开
```

## 测试

```bash
# 后端单测
cd server && npm test
# 后端集成测试（需 Postgres + Redis，见 CI）
npm run test:integration
# 前端
cd app && npm test
```

CI（`.github/workflows/backend-ci.yml`）在真实 Postgres + Redis service 容器上跑迁移 + 单测 + 集成测试。

## 部署

见 [`server/DEPLOYMENT.md`](server/DEPLOYMENT.md)。生产建议：托管 PostgreSQL（主从）+ 托管 Redis、多实例调度分片、Sentry 监控、告警送达率看板。

## 文档索引

| 文档 | 说明 |
|------|------|
| [PROJECT-STATUS.md](PROJECT-STATUS.md) | 开发过程状态总览与上线 checklist |
| [独居提醒-PRD-Phase1-v2.0.md](独居提醒-PRD-Phase1-v2.0.md) | 最新产品需求文档 |
| [独居提醒-产品探索文档.md](独居提醒-产品探索文档.md) | 产品定位与探索 |
| [competitor-research-reminder-apps.md](competitor-research-reminder-apps.md) | 竞品研究 |
| [ACCEPTANCE-TESTING.md](ACCEPTANCE-TESTING.md) | 验收测试用例 |
| [server/SPEC-S1-auth.md](server/SPEC-S1-auth.md) · [SPEC-S3-reminder-engine.md](server/SPEC-S3-reminder-engine.md) | 后端技术规范 |
| [server/DEPLOYMENT.md](server/DEPLOYMENT.md) | 部署指南 |
