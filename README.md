# 今天还好 · are you ok today

面向独居人群的安全守护 App。用户每天确认一次“平安”；若在提醒窗口结束后仍未确认，系统会进入宽限期，并在超时后通过推送、短信、语音电话通知紧急联系人或子女。

## 当前状态

- 前端：Expo 56 / React Native 0.85 / Expo Router，主打 iOS 与 App Store 分发
- 后端：NestJS 11 / Prisma / PostgreSQL / Redis / BullMQ
- 实时能力：SSE + Redis pub/sub，状态变化不再依赖 30 秒轮询
- 通知能力：APNs、阿里云短信、阿里云语音电话，开发环境可用 mock provider
- 订阅能力：Apple IAP / StoreKit 2，支持本人订阅和子女代付
- 发布配置：已提供 `app/eas.json`、`app/.env.example`、`server/.env.example`

## 目录结构

```text
.
├── app/                  # Expo / React Native 前端
│   ├── src/app/          # Expo Router 页面路由
│   ├── src/services/     # API、SSE、通知、IAP、深链、错误上报
│   ├── src/store/        # Zustand 全局状态
│   └── src/components/   # UI 组件与主题
├── server/               # NestJS 后端
│   ├── src/              # auth、reply、reminder、alert、guardian、subscription 等模块
│   ├── prisma/           # PostgreSQL schema 与 migrations
│   └── docker-compose.yml
└── *.md                  # 产品、状态、验收与研究文档
```

## 核心链路

1. 用户完成注册、协议确认、联系人、提醒时间和通知授权。
2. `ReminderConfig.nextDueAt` 驱动每分钟调度，只扫描已到期记录。
3. 未确认用户进入 `grace`，发送关怀提醒。
4. 宽限期后仍未确认则进入 `alert`，异步通知紧急联系人。
5. 状态变化通过 Redis pub/sub 与 SSE 推给前端。
6. 子女端可绑定被守护人、查看看板、代确认、代付订阅。

## 快速开始

### 后端

```bash
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

本地依赖 PostgreSQL 与 Redis。也可以直接使用 Docker Compose：

```bash
cd server
cp .env.example .env
docker compose up -d --build
```

Swagger 地址：`http://localhost:3000/api/docs`

### 前端

```bash
cd app
cp .env.example .env
npm install
npx expo start
```

真机测试时把 `EXPO_PUBLIC_API_URL` 改为局域网可访问的后端地址，例如：

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
```

## 验证命令

```bash
# app
cd app
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npx expo-doctor
npm audit --audit-level=moderate

# server
cd server
npm run prisma:generate
npm test -- --runInBand
npm run build
npm audit --audit-level=moderate
```

后端真实集成测试需要 PostgreSQL + Redis：

```bash
cd server
npm run test:integration
```

GitHub Actions 的 Backend CI 会在真实 PostgreSQL + Redis service 容器中跑迁移、单测、集成测试和构建。

## 发布入口

- iOS 构建：`cd app && npx eas build --platform ios --profile production`
- iOS 提交：`cd app && npx eas submit --platform ios --profile production`
- 后端部署：见 [server/DEPLOYMENT.md](server/DEPLOYMENT.md)

## 文档索引

| 文档 | 用途 |
|------|------|
| [PROJECT-STATUS.md](PROJECT-STATUS.md) | 当前进度、剩余上线事项、风险 |
| [ACCEPTANCE-TESTING.md](ACCEPTANCE-TESTING.md) | 人工验收流程 |
| [app/README.md](app/README.md) | 前端开发、环境变量、EAS 构建 |
| [server/API.md](server/API.md) | 当前后端 API 索引 |
| [server/DEPLOYMENT.md](server/DEPLOYMENT.md) | 后端部署与生产配置 |
| [独居提醒-PRD-Phase1-v2.0.md](独居提醒-PRD-Phase1-v2.0.md) | 当前保留的产品需求文档 |
| [独居提醒-产品探索文档.md](独居提醒-产品探索文档.md) | 产品方向与边界 |
| [competitor-research-personal-reminder-apps.md](competitor-research-personal-reminder-apps.md) | 竞品研究 |

历史 PRD、变更记录、阶段规划和已过期 SPEC 已删除，避免继续误导开发。
