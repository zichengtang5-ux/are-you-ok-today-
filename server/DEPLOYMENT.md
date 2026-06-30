# 今天还好 — 后端部署指南

## 前置要求

- Docker 20.10+
- Docker Compose v2+
- （可选）Node.js 20+ 用于本地开发

## 环境变量

复制 `.env.example` 为 `.env`，根据环境修改：

```bash
cp .env.example .env
```

**生产环境必须修改的项**：

| 变量 | 说明 | 示例 |
|------|------|------|
| `JWT_SECRET` | JWT 签名密钥（≥32 字符随机字符串） | `openssl rand -base64 48` |
| `NODE_ENV` | 运行环境 | `production` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/today_ok?schema=public` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 连接（缓存 / 限流 / BullMQ 队列） | `redis.internal` / `6379` / `<强密码>` |
| `SCHEDULER_SHARD_INDEX` / `SCHEDULER_SHARD_TOTAL` | 多实例调度分片（各实例不同 INDEX） | `0` / `4` |

## Docker 部署（推荐）

### 构建并启动

```bash
# 构建镜像 + 启动容器（后台运行）
docker compose up -d --build

# 查看日志
docker compose logs -f api

# 停止
docker compose down
```

### 数据持久化

`docker compose` 会启动三个服务：`api`、`postgres`、`redis`。
- PostgreSQL 数据存储在 volume `pg-data`（容器内 `/var/lib/postgresql/data`）。
- Redis（AOF 持久化）存储在 volume `redis-data`。

备份数据库：
```bash
docker compose exec postgres pg_dump -U todayok today_ok > ./backup-$(date +%Y%m%d).sql
```

### 数据库迁移

容器启动时自动执行 `prisma migrate deploy`，无需手动操作。

如需手动迁移：
```bash
docker compose exec api npx prisma migrate deploy
```

## 本地开发

```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 运行迁移
npx prisma migrate dev

# 启动开发服务器（热重载）
npm run start:dev
```

API 文档：http://localhost:3000/api/docs

## 健康检查

生产容器内置健康检查，访问 `/api/docs` 端点。

手动验证：
```bash
curl http://localhost:3000/api/docs
```

## 生产环境建议

1. **数据库**：使用托管 PostgreSQL（如阿里云 RDS），配置主从读写分离与连接池；热点表（DailyRecord/AlertEvent）按用户分区
2. **Redis**：使用托管 Redis（如阿里云 Tair），承载缓存、限流计数与 BullMQ 队列；开启持久化与高可用
3. **多实例调度**：水平扩展时每个实例设置不同 `SCHEDULER_SHARD_INDEX`，避免 cron 重复触发
4. **反向代理**：建议在前面加 Nginx/Caddy 做 TLS 终止
5. **日志收集**：接入 CloudWatch / 阿里云 SLS
6. **监控**：接入 Sentry（应用错误）+ 阿里云云监控（资源），对告警触发量与通知送达率单独建看板
7. **备份**：每日自动 `pg_dump`
8. **短信/推送**：上线前配置阿里云 SMS 和 APNs 真实凭证

## 端口映射

默认映射 `3000:3000`，可通过 `.env` 中 `PORT` 修改：
```bash
PORT=8080  # .env 中修改
```

然后 docker-compose.yml 中对应修改端口映射，或直接使用 `HOST_PORT:3000` 模式。
