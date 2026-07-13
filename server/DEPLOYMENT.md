# 后端部署指南

后端是 NestJS + Prisma + PostgreSQL + Redis + BullMQ。生产环境不要使用 SQLite，当前 schema 只面向 PostgreSQL。

## 前置要求

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker / Docker Compose v2（可选）

## 本地 Docker 启动

```bash
cd server
cp .env.example .env
docker compose up -d --build
```

服务：

- API：`http://localhost:3000`
- Swagger：`http://localhost:3000/api/docs`
- PostgreSQL：容器内 `postgres:5432`
- Redis：容器内 `redis:6379`

## 本地非 Docker 启动

```bash
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

如果要创建新 migration：

```bash
npm run prisma:migrate
```

## 生产环境变量

以 `server/.env.example` 为模板。

### 必填

| 变量 | 说明 |
|------|------|
| `NODE_ENV=production` | 生产模式 |
| `PORT` | API 端口 |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 连接 |
| `JWT_SECRET` | 至少 32 字符的随机密钥 |
| `JWT_ACCESS_EXPIRES_IN` | access token 有效期 |
| `JWT_REFRESH_EXPIRES_IN` | refresh token 有效期 |

### 调度分片

| 变量 | 说明 |
|------|------|
| `SCHEDULER_SHARD_INDEX` | 当前实例编号，从 0 开始 |
| `SCHEDULER_SHARD_TOTAL` | 总实例数 |

单实例：

```env
SCHEDULER_SHARD_INDEX=0
SCHEDULER_SHARD_TOTAL=1
```

多实例时每个实例必须使用不同 `SCHEDULER_SHARD_INDEX`，避免重复触发提醒。

### 通知 provider

开发环境可以使用 mock：

```env
SMS_PROVIDER=mock
VOICE_PROVIDER=mock
APNS_PROVIDER=mock
```

生产环境建议：

```env
SMS_PROVIDER=aliyun
VOICE_PROVIDER=aliyun
APNS_PROVIDER=apns
```

需要同时配置：

- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_SMS_SIGN_NAME`
- `ALIYUN_SMS_VERIFY_TEMPLATE_CODE`
- `ALIYUN_SMS_ALERT_TEMPLATE_CODE`
- `ALIYUN_VOICE_ALERT_TEMPLATE_CODE`
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_KEY_PATH`
- `APNS_BUNDLE_ID`

### Apple IAP

生产订阅校验需要：

- `APPLE_IAP_ISSUER_ID`
- `APPLE_IAP_KEY_ID`
- `APPLE_IAP_KEY_PATH`
- `APPLE_APP_ID`
- `APPLE_ROOT_CA_PATHS`，Apple Root CA DER 文件路径，多个用逗号分隔
- `APPLE_IAP_MONTHLY_PRODUCT_ID`
- `APPLE_IAP_YEARLY_PRODUCT_ID`

服务端使用 Apple 官方 `@apple/app-store-server-library` 校验交易签名、产品和真实到期时间。上线前还需在 App Store Connect 配置 App Store Server Notifications V2，用于续期、退款和撤销后的主动同步。

### Apple Maps Server API（可选）

紧急求助会始终先保存坐标；配置以下参数后，服务端会在不超过 `APPLE_MAPS_TIMEOUT_MS` 的时间内补全中文地址。未配置、超时或额度受限时自动降级为客户端地址或坐标地图链接，不阻塞短信发送。

- `APPLE_MAPS_TEAM_ID`
- `APPLE_MAPS_KEY_ID`
- `APPLE_MAPS_PRIVATE_KEY_PATH`，或使用 `APPLE_MAPS_PRIVATE_KEY` 直接注入私钥
- `APPLE_MAPS_TIMEOUT_MS`，默认 `1800`

私钥必须只保存在服务端。需要先在 Apple Developer 后台创建 Maps ID 和 Maps 私钥。

## 部署步骤

1. 创建 PostgreSQL 数据库。
2. 创建 Redis 实例。
3. 配置 `.env`。
4. 生成 Prisma Client。
5. 执行 migration。
6. 启动 API。

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build
npm run start:prod
```

Docker 部署时容器启动命令应保证先执行：

```bash
npx prisma migrate deploy
node dist/main
```

## 健康检查

当前 Docker Compose 使用 Swagger 端点作为健康检查：

```bash
curl http://localhost:3000/api/docs
```

生产环境建议增加独立 `/health` 接口，便于负载均衡器检查。

## CI

`.github/workflows/backend-ci.yml` 会在 pull request 和 `main` push 时运行：

1. `npm ci`
2. `npx prisma generate`
3. `npx prisma migrate deploy`
4. `npx prisma migrate status`
5. `npm test`
6. `npm run test:integration`
7. `npm run build`

CI 使用真实 PostgreSQL 和 Redis service 容器。

## 生产建议

- PostgreSQL 使用托管数据库，开启自动备份。
- Redis 使用托管实例，开启持久化和访问控制。
- API 前面放 HTTPS 反向代理或云负载均衡。
- APNs `.p8` key 不要放进仓库。
- 阿里云 AccessKey 使用最小权限 RAM 用户。
- 接入 Sentry 或同类错误上报。
- 建立通知送达率、告警触发量、任务失败率看板。
- 定期验证短信、语音、APNs、IAP 的真实链路。

## 备份

Docker 本地备份示例：

```bash
docker compose exec postgres pg_dump -U todayok today_ok > backup-$(date +%Y%m%d).sql
```

生产建议使用云数据库自动备份，保留至少 7 天。
