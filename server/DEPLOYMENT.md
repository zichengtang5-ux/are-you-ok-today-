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
| `DATABASE_URL` | 数据库连接 | `file:./data/prod.db` (SQLite) 或 PostgreSQL URL |

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

SQLite 数据库文件存储在 Docker volume `db-data` 中（容器内 `/app/data/`）。

备份数据库：
```bash
docker compose exec api cp /app/data/prod.db /tmp/backup.db
docker cp today-ok-api:/tmp/backup.db ./backup-$(date +%Y%m%d).db
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

1. **数据库**：SQLite 适合初期（< 1000 用户），后续迁移到 PostgreSQL
2. **反向代理**：建议在前面加 Nginx/Caddy 做 TLS 终止
3. **日志收集**：接入 CloudWatch / 阿里云 SLS
4. **监控**：接入 UptimeRobot / 阿里云云监控
5. **备份**：每日自动备份 SQLite 文件（或 PostgreSQL dump）
6. **短信/推送**：上线前配置阿里云 SMS 和 APNs 真实凭证

## 端口映射

默认映射 `3000:3000`，可通过 `.env` 中 `PORT` 修改：
```bash
PORT=8080  # .env 中修改
```

然后 docker-compose.yml 中对应修改端口映射，或直接使用 `HOST_PORT:3000` 模式。
