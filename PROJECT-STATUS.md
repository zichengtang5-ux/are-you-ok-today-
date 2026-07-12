# 项目状态总览

最后更新：2026-07-07
当前主分支：`main`
最新验证：前端交互全流程模拟器回归 + 前后端单测

## 总体结论

项目已经具备 Phase 1 的核心产品闭环：

- 注册登录、引导、地址定位/填写、联系人、提醒时间、通知授权
- 每日确认、撤销、暂停/恢复、删除账号
- `idle / waiting / replied / grace / alert / paused` 状态链路
- 关怀提醒、超时告警、短信、语音电话、APNs 推送
- 本期前端保持极简：家庭守护、关怀看板、代确认、代付订阅入口已下线
- SSE 实时状态同步
- Apple IAP 代码与 EAS Build 配置
- PostgreSQL + Redis + BullMQ 后端基础设施
- 告警联系人确认/求助、联系人排序、连续天数等前后端契约已对齐

当前不再维护旧的阶段协作文档、历史 PRD 版本和过期 SPEC。开发以本文档、根 README、`app/README.md`、`server/API.md`、`server/DEPLOYMENT.md` 为准。

## 已完成

### 前端

- Expo SDK 56 依赖已对齐，`expo-doctor` 通过
- `react-native-iap` 已接入，iOS bundle 阻塞已解除
- `eas.json` 已创建，包含 preview 与 production profile
- API、App Store、用户协议、隐私政策 URL 已改为环境变量配置
- 设置页删除账号已接入后端，并清理 token、重置本地状态、跳回登录页
- 设置页临时暂停/恢复已接入后端
- 用户协议和隐私政策入口已从配置读取 URL
- 告警联系人页支持 `alertId + contactId` 深链场景，可确认安全或进入求助建议页
- 地址页支持定位填充地址
- 紧急求助页采用红色圆形 SOS，进入即定位，支持补充门牌并通知已验证联系人；不提供 110/120 入口或自动拨号
- 紧急联系人引导不再要求填写联系人验证码
- 提醒时间改为开始/结束整点滚动选择
- 底部 tab、守护中心、关怀看板、家庭守护入口已移除
- 电话、App Store、协议、隐私政策等外部链接已统一失败兜底
- 版本号从 Expo config 读取
- 废弃 `ConfirmButton`、`Tag`、`mock.ts` 已删除
- 前端 `npm audit --audit-level=moderate` 为 0 vulnerabilities

### 后端

- PostgreSQL schema 与 migrations 已稳定
- Redis 用于限流、BullMQ、SSE pub/sub
- 提醒引擎按 `nextDueAt` 索引扫描，支持时区与调度分片
- 通知投递进入 BullMQ，支持重试和死信
- APNs、阿里云短信、阿里云语音电话服务已接入
- Apple IAP receipt / transaction 校验服务已接入
- `GET /alert/:id`、`POST /alert/:id/confirm`、`POST /alert/:id/help` 已补齐
- `PUT /contacts/reorder` 与 `GET /reply/streak` 已补齐
- 告警通知短信包含 `todayok://alert/:id?contactId=...` 链接
- 后端 `npm audit --audit-level=moderate` 为 0 vulnerabilities
- Backend CI 在真实 PostgreSQL + Redis 上通过

## 最近验证

### 前端

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npx expo install --check
npx expo-doctor
npm audit --audit-level=moderate
npx expo export --platform ios --output-dir /tmp/expo-export
```

结果：

- 类型检查通过
- 10 个 test suites / 88 个 tests 通过
- lint 0 errors，仍有少量 warnings
- Expo 依赖检查通过
- iOS export 成功
- audit 0 vulnerabilities
- iPhone 16 Pro / iOS 18.6 模拟器完成登录引导、每日签到/撤销、告警确认、告警求助、SOS、mock 订阅、暂停/恢复、电话兜底回归；本期不再验收家庭守护和关怀看板

### 后端

```bash
npm run prisma:generate
npm test -- --runInBand
npm run build
npm audit --audit-level=moderate
```

结果：

- Prisma Client 生成通过
- 20 个 test suites / 145 个 tests 通过
- 构建通过
- audit 0 vulnerabilities

本地回归使用真实 PostgreSQL 16 + Redis 运行迁移、后端服务和前端模拟器。

## 上线前剩余事项

| 优先级 | 事项 | 负责人 | 状态 |
|--------|------|--------|------|
| P0 | 注册 Apple Developer Program | 产品/运营 | 待办 |
| P0 | 创建 App Store Connect App 与 bundle id `com.todayok.app` | 产品/运营 | 待办 |
| P0 | 配置真实隐私政策 URL 与用户协议 URL | 产品/法务 | 待办 |
| P0 | 配置生产 API 域名与 HTTPS | 后端/运维 | 待办 |
| P0 | 配置生产 PostgreSQL 与 Redis | 后端/运维 | 待办 |
| P0 | 配置 APNs Auth Key 与 bundle id | 后端/运营 | 待办 |
| P0 | 配置阿里云 SMS / Voice 模板并完成审核 | 后端/运营 | 待办 |
| P0 | 创建 Apple IAP 订阅产品 | 产品/运营 | 待办 |
| P0 | 用真实 StoreKit / sandbox account 跑订阅联调 | 前后端 | 待办 |
| P1 | 准备 App Store 截图、描述、隐私标签、审核说明 | 产品/运营 | 待办 |
| P1 | 真机回归测试通知、定位、深链、购买 | 前端 | 待办 |
| P1 | 生产错误上报与日志看板 | 前后端 | 待办 |

## 当前风险

| 风险 | 影响 | 处理 |
|------|------|------|
| Apple 开发者账号未完成 | 无法提交 App Store | 先完成个人/公司账号注册与付款 |
| 用户协议/隐私政策无公开 URL | App Store 审核会卡 | 先托管到可公开访问页面 |
| 阿里云短信/语音模板未审核 | 真实告警链路不可用 | 提前申请模板并准备备用话术 |
| APNs 凭证未配置 | 真机推送不可用 | 准备 `.p8` key、Key ID、Team ID、Bundle ID |
| IAP 产品未创建 | 订阅无法真实购买 | App Store Connect 创建月/年订阅并联调 |
| Expo Go 不接管自定义 `todayok://` scheme | 模拟器里无法完整验证生产深链 | 用 EAS dev/internal build 在真机验证告警链接 |

## 建议下一步

1. 先完成 Apple Developer Program 注册。
2. 创建 App Store Connect App：名称、bundle id、SKU、隐私政策 URL。
3. 创建 IAP 产品：月付、年付。
4. 配好生产后端域名和环境变量。
5. 产出第一版 EAS internal build 做真机验收。
