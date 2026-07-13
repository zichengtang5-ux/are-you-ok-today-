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
| `GET` | `/api/auth/me` | 当前用户、联系人、提醒和订阅权益 |

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
| `PUT` | `/api/contacts/reorder` | 按联系人 id 数组重排优先级 |

当前产品流程保存联系人后即可使用，不要求联系人验证码。免费版最多 1 位，守护版最多 5 位；后端会检查订阅到期时间、拒绝重复手机号，并以串行化事务防止并发绕过上限。守护版到期后，列表、超时告警和 SOS 统一只使用优先级最高的 1 位联系人；其余联系人保留在账号中，重新订阅后恢复，避免降级时直接丢失用户数据。旧版联系人验证码接口暂为兼容保留，不供当前前端调用。

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

`GET /reply/status` 返回绝对时间 `graceDeadlineAt`，跨午夜倒计时以该字段为准；`monthlyStats.totalDays` 始终是当月总天数。`POST /reply/today` 为幂等接口，重复提交仍返回成功状态。

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

## Pause

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/pause` | 暂停守护 |
| `POST` | `/api/pause/resume` | 恢复守护 |
| `GET` | `/api/pause/status` | 暂停状态 |

暂停期间提醒引擎不会触发告警；提前恢复和自然到期都会重新计算 `nextDueAt`，恢复后不会漏掉下一次提醒。

## Help

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/help/emergency` | 发起紧急求助 |
| `GET` | `/api/help/address` | 获取用户保存地址 |

前端优先提交定位，经纬度不可用时回退保存地址。

`POST /help/emergency` 接收经纬度、误差半径、采集时间、定位来源、精确位置授权状态、地址来源和用户确认状态。`deliveryStatus` 为 `sent | partial | failed | no_contacts`，并分别返回 `contactsNotified` 与 `contactsFailed`。`sent` 表示短信服务商已接受发送请求，不表示联系人已阅读。

服务端只在当前坐标距离预存住址 100 米以内时自动采用预存的楼栋门牌；否则使用 Apple Maps Server API 补全地址。地址服务不可用时仍发送坐标地图链接，不会将可能错误的家庭住址冒充为当前位置。

## Subscription

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/subscription/verify` | 校验 Apple IAP 交易 |
| `GET` | `/api/subscription/status` | 当前订阅状态 |

生产校验使用 Apple 官方 App Store Server Library，校验签名、bundle id、产品 id、真实到期时间和原始交易归属。生产联调前需创建订阅产品，并配置 IAP 私钥、Apple Root CA、App Apple ID 与产品 ID 环境变量。

## 调试建议

- 具体 DTO 和响应字段以 Swagger 为准。
- 自动化测试优先参考 `server/src/**/*.spec.ts`。
- 前端类型定义位于 `app/src/services/api.types.ts`。
- 当前前端声明的 API 已与后端 controller 对齐。新增前端接口时同步更新本文件和对应 controller/service 测试。
