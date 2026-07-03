# 后端 API 索引

服务地址默认：`http://localhost:3000`  
API 前缀：`/api`  
Swagger：`/api/docs`

除认证接口外，请求头需要：

```http
Authorization: Bearer <accessToken>
```

## Auth

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/send-code` | 发送手机号验证码 |
| `POST` | `/api/auth/verify-code` | 验证验证码并登录/注册 |
| `POST` | `/api/auth/refresh` | 刷新 token |
| `GET` | `/api/auth/me` | 当前用户与守护关系 |

开发环境 `SMS_PROVIDER=mock` 时，`send-code` 响应可包含 `mockCode`。

## User

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/user/profile` | 获取个人资料 |
| `PATCH` | `/api/user/profile` | 更新昵称、地址等资料 |
| `PATCH` | `/api/user/onboarding` | 更新引导进度 |
| `DELETE` | `/api/user/account` | 删除账号 |

删除账号需要前端传入确认文本；成功后前端应清 token、重置本地状态并回到登录页。

## Contacts

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/contacts` | 紧急联系人列表 |
| `POST` | `/api/contacts` | 新增紧急联系人 |
| `PATCH` | `/api/contacts/:id` | 更新联系人 |
| `DELETE` | `/api/contacts/:id` | 删除联系人 |
| `POST` | `/api/contacts/:id/send-code` | 发送联系人验证短信 |
| `POST` | `/api/contacts/:id/verify` | 验证联系人手机号 |
| `PUT` | `/api/contacts/reorder` | 按联系人 id 数组重排优先级 |

## Reminder / Reply

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/reminder/config` | 获取提醒窗口配置 |
| `PATCH` | `/api/reminder/config` | 更新提醒窗口、宽限期、时区 |
| `POST` | `/api/reply/today` | 今日确认平安 |
| `DELETE` | `/api/reply/today` | 撤销今日确认 |
| `GET` | `/api/reply/status` | 当前守护状态 |
| `GET` | `/api/reply/streak` | 当前连续确认天数 |

状态值：

```text
idle | waiting | replied | grace | alert | paused
```

## Alert

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/alert/active` | 当前活跃告警详情，无活跃告警返回 `null` |
| `GET` | `/api/alert/:id` | 指定告警详情，联系人链接可带 `?contactId=` |
| `POST` | `/api/alert/:id/confirm` | 联系人确认用户安全，解除告警 |
| `POST` | `/api/alert/:id/help` | 联系人标记联系不上，返回求助建议 |

告警短信会携带 `todayok://alert/:id?contactId=...`。生产前需要在真机构建中验证 scheme 打开和参数传递。

## Device

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/device/register` | 上报 APNs / 设备推送 token |

当前设备 token 以 `userId + token` 去重。

## Events

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/events/stream` | SSE 实时事件流 |

用于推送 `status_changed` 等状态事件。前端实现位于 `app/src/services/realtime.ts`。

## Guardian

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/guardian/create` | 创建守护邀请 |
| `POST` | `/api/guardian/accept-invite` | 接受邀请码 |
| `GET` | `/api/guardian/wards` | 子女端守护对象列表 |
| `GET` | `/api/guardian/wards/:id/dashboard` | 被守护人看板 |
| `POST` | `/api/guardian/wards/:id/proxy-reply` | 子女代确认 |

## Pause

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/pause` | 暂停守护 |
| `POST` | `/api/pause/resume` | 恢复守护 |
| `GET` | `/api/pause/status` | 暂停状态 |

暂停期间提醒引擎不会触发告警。

## Help

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/help/emergency` | 发起紧急求助 |
| `GET` | `/api/help/address` | 获取用户保存地址 |

前端优先提交定位，经纬度不可用时回退保存地址。

## Subscription

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/subscription/verify` | 校验 Apple IAP 交易 |
| `POST` | `/api/subscription/proxy-subscribe` | 子女代付订阅 |
| `GET` | `/api/subscription/status` | 当前订阅状态 |

生产联调前需要在 App Store Connect 创建订阅产品，并配置 Apple IAP 私钥环境变量。

## 调试建议

- 具体 DTO 和响应字段以 Swagger 为准。
- 自动化测试优先参考 `server/src/**/*.spec.ts`。
- 前端类型定义位于 `app/src/services/api.types.ts`。
- 当前前端声明的 API 已与后端 controller 对齐。新增前端接口时同步更新本文件和对应 controller/service 测试。
