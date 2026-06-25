# 今天还好 — 前端对接 API 文档 (S1)

> 后端服务地址: `http://localhost:3000`
> Swagger 文档: `http://localhost:3000/api/docs`
> 所有 API 前缀: `/api`

---

## 认证机制

- 公开 API（无需 token）: `send-code`, `verify-code`, `refresh`
- 受保护 API: 请求头带 `Authorization: Bearer <accessToken>`
- Token 过期后用 `refresh` 接口换取新 token

### Token 规格

| Token | 有效期 | 用途 |
|-------|--------|------|
| accessToken | 15 分钟 | 访问受保护 API |
| refreshToken | 30 天 | 刷新 accessToken |

---

## API 列表

### 1. POST /api/auth/send-code

发送短信验证码（开发环境 mock 模式，验证码直接返回在响应中）

**请求:**
```json
{ "phone": "13812345678" }
```

**响应:**
```json
{
  "message": "验证码已发送",
  "cooldownSeconds": 60,
  "mockCode": "123456"          // 仅开发环境返回
}
```

**频率限制:** 同一手机号 60 秒内只能发送一次

---

### 2. POST /api/auth/verify-code

验证码校验 + 自动注册/登录

**请求:**
```json
{ "phone": "13812345678", "code": "123456" }
```

**响应:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": {
    "id": "cmqs32279...",
    "phone": "13812345678",
    "nickname": null,
    "isOnboarded": false,
    "onboardingStep": "agreement"
  }
}
```

**新用户自动注册**，`onboardingStep` 初始值为 `"agreement"`

---

### 3. POST /api/auth/refresh

刷新 accessToken

**请求:**
```json
{ "refreshToken": "eyJhbG..." }
```

**响应:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

---

### 4. GET /api/auth/me 🔒

获取当前用户完整信息（含联系人、提醒配置、守护状态等）

**响应:**
```json
{
  "id": "cmqs33ej2...",
  "phone": "13800001111",
  "nickname": null,
  "address": null,
  "onboardingStep": "agreement",
  "isOnboarded": false,
  "notificationAuth": false,
  "createdAt": "2026-06-24T13:03:21.423Z",
  "updatedAt": "2026-06-24T13:03:21.423Z",
  "contacts": [],
  "reminderConfig": null,
  "guardStatus": null,
  "subscription": null,
  "guardianOf": [],
  "wardOf": []
}
```

---

### 5. GET /api/user/profile 🔒

获取用户基本资料

---

### 6. PATCH /api/user/profile 🔒

更新用户资料（昵称、住址、通知授权）

**请求:**
```json
{
  "nickname": "小李",
  "address": "北京市朝阳区xxx",
  "notificationAuth": true
}
```

---

### 7. PATCH /api/user/onboarding 🔒

更新引导进度

**请求:**
```json
{
  "step": "basic-info",        // agreement | basic-info | contact-setup | reminder-time | notification-auth | complete
  "isOnboarded": false          // 完成全部引导后设为 true
}
```

---

## 前端对接要点

1. **Token 存储**: accessToken 和 refreshToken 建议存在 SecureStorage / Keychain
2. **Token 刷新**: accessToken 过期（15分钟）时自动调用 refresh，refreshToken 也返回新值需更新
3. **引导流程**: 根据 `user.onboardingStep` 判断当前步骤，完成后调用 PATCH /api/user/onboarding 更新
4. **开发环境**: mockCode 字段仅在 SMS_PROVIDER=mock 时返回，可用于自动填充验证码

## onboardingStep 流转

```
login → agreement → basic-info → contact-setup → reminder-time → notification-auth → complete
```

完成后设 `isOnboarded: true`，进入守护首页。
