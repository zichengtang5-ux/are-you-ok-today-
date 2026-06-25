# 前端对接进度 — 已完成 S1 认证部分

> 更新时间：2026-06-24
> 前端负责人：小前
> 状态：S1 认证流程已对接完成

## 已对接完成 ✅

### 1. 认证流程
- ✅ 手机号+验证码登录（`POST /api/auth/send-code` + `POST /api/auth/verify-code`）
- ✅ Token 自动刷新（`POST /api/auth/refresh`）
- ✅ 双 Token 存储（access_token + refresh_token in AsyncStorage）
- ✅ 401 自动重试机制（并发请求只刷新一次）
- ✅ 开发环境自动填充 mockCode

### 2. 用户状态恢复
- ✅ App 启动时调用 `GET /api/auth/me` 恢复用户状态
- ✅ 根据 `isOnboarded` 跳转对应页面
- ✅ 根据 `onboardingStep` 恢复引导流程断点

### 3. 引导流程进度同步
- ✅ 每步完成后调用 `PATCH /api/user/onboarding` 更新进度
- ✅ 协议页（agreement）→ 基本信息（basic-info）已对接
- ⏳ 联系人设置、提醒时间、通知授权待对接

### 4. 用户资料更新
- ✅ `PATCH /api/user/profile` 更新昵称、地址
- ✅ 通知权限状态同步

## API Client 封装

### 核心特性
- ✅ Axios 拦截器（请求添加 Token、响应处理 401）
- ✅ Token 自动刷新（并发请求只刷新一次）
- ✅ 错误处理（400/401/429/500）
- ✅ TypeScript 类型定义完整

### 已封装的 API
```typescript
authApi.sendCode()         // 发送验证码
authApi.verifyCode()       // 验证码登录
authApi.refresh()          // 刷新 Token
authApi.getMe()            // 获取当前用户

userApi.getProfile()       // 获取用户资料
userApi.updateProfile()    // 更新用户资料
userApi.updateOnboarding() // 更新引导进度
```

## 待对接（等小后提供后续接口）

### P0 核心链路
- ⏳ 联系人 CRUD（`/api/contacts`）
- ⏳ 联系人验证（`/api/contacts/:id/verify`）
- ⏳ 提醒配置（`/api/reminder/config`）
- ⏳ 今日回复（`/api/reply/today`）
- ⏳ 守护状态（`/api/reply/status`）

### P1 增值功能
- ⏳ 告警流程（`/api/alert`）
- ⏳ 关怀看板（`/api/guardian`）
- ⏳ 订阅付费（`/api/subscription`）

## 前端已就绪

### 页面（UI 完成，待对接 API）
- ✅ 登录页（完整流程，已对接）
- ✅ 协议页（含勾选，已对接）
- ✅ 基本信息（昵称+地址，已对接）
- ⏳ 联系人设置（UI 完成）
- ⏳ 提醒时间（UI 完成）
- ⏳ 通知授权（UI 完成）
- ⏳ 首页 5 状态（UI 完成）
- ⏳ 告警流程（UI 完成）
- ⏳ 关怀看板（UI 完成）
- ⏳ 设置页（UI 完成）

### 组件库
- ✅ Button（5 种变体）
- ✅ Card（4 种变体）
- ✅ Input（带验证）
- ✅ Dialog（确认对话框）
- ✅ Banner（信息/警告/危险）
- ✅ StreakBadge（连续天数）
- ✅ Timeline（时间线）
- ✅ LoadingState / ErrorState / EmptyState / Skeleton

## 需要小后提供的下一步接口

1. **联系人 CRUD 接口**：创建、查询、更新、删除
2. **联系人验证接口**：发送验证码、验证手机号
3. **提醒配置接口**：获取、更新
4. **今日回复接口**：回复、撤回、状态查询
5. **守护状态接口**：idle/waiting/replied/grace/alert

## 测试方式

### 启动后端
```bash
cd server
npm run start:dev
```

### 启动前端
```bash
cd app
npm start
```

### 测试登录流程
1. 打开 App → 自动跳转登录页
2. 输入手机号 → 点击"发送验证码"
3. 开发环境会自动填充 mockCode
4. 点击"登录" → 跳转协议页
5. 勾选协议 → 点击"同意并继续"
6. 填写昵称 → 点击"下一步"
7. 后续页面待对接

### 测试 Token 刷新
1. 手动修改 AsyncStorage 中的 access_token 为过期值
2. 触发任何受保护 API 调用
3. 观察是否自动刷新并重试

## 问题反馈

暂无问题，接口文档清晰，mockCode 字段方便调试 👍

---

## 下一步行动

**小前（我）**：等待小后提供联系人相关接口文档

**小后**：请提供以下接口文档
1. 联系人 CRUD 接口
2. 联系人验证接口
3. 提醒配置接口
4. 今日回复接口
5. 守护状态接口

**你（产品方）**：协调双方，确认接口契约无误
