# 项目状态总览

最后更新：2026-07-02
当前主分支：`main`
最新合入：`0854a50` / PR #27

## 总体结论

项目已经具备 Phase 1 的核心产品闭环：

- 注册登录、引导、联系人、提醒时间、通知授权
- 每日确认、撤销、暂停/恢复、删除账号
- `idle / waiting / replied / grace / alert / paused` 状态链路
- 关怀提醒、超时告警、短信、语音电话、APNs 推送
- 子女端绑定、看板、代确认、代付订阅
- SSE 实时状态同步
- Apple IAP 代码与 EAS Build 配置
- PostgreSQL + Redis + BullMQ 后端基础设施

当前不再维护旧的阶段协作文档、历史 PRD 版本和过期 SPEC。开发以本文档、根 README、`app/README.md`、`server/API.md`、`server/DEPLOYMENT.md` 为准。

## 已完成

### 前端

- Expo SDK 56 依赖已对齐，`expo-doctor` 通过
- `react-native-iap` 已接入，iOS bundle 阻塞已解除
- `eas.json` 已创建，包含 preview 与 production profile
- API、App Store、用户协议、隐私政策 URL 已改为环境变量配置
- 设置页删除账号已接入后端，并清理 token、重置本地状态、跳回登录页
- 用户协议和隐私政策入口已从配置读取 URL
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
- 10 个 test suites / 83 个 tests 通过
- lint 0 errors，仍有少量 warnings
- Expo 依赖检查通过
- iOS export 成功
- audit 0 vulnerabilities

### 后端

```bash
npm run prisma:generate
npm test -- --runInBand
npm run build
npm audit --audit-level=moderate
```

结果：

- Prisma Client 生成通过
- 19 个 test suites / 135 个 tests 通过
- 构建通过
- audit 0 vulnerabilities

GitHub PR #27 的 `Backend Test (Postgres + Redis)` 已通过。

## 上线前剩余事项

| 优先级 | 事项 | 负责人 | 状态 |
|--------|------|--------|------|
| P0 | 对齐前后端接口缺口：`/alert/:id/confirm`、`/alert/:id/help`、`/contacts/reorder`、`/reply/streak` | 前后端 | 待修 |
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
| 前端仍调用少量后端未实现接口 | 告警联系人处理、联系人排序、连续天数可能失败 | 优先补后端接口或移除前端调用 |
| Apple 开发者账号未完成 | 无法提交 App Store | 先完成个人/公司账号注册与付款 |
| 用户协议/隐私政策无公开 URL | App Store 审核会卡 | 先托管到可公开访问页面 |
| 阿里云短信/语音模板未审核 | 真实告警链路不可用 | 提前申请模板并准备备用话术 |
| APNs 凭证未配置 | 真机推送不可用 | 准备 `.p8` key、Key ID、Team ID、Bundle ID |
| IAP 产品未创建 | 订阅无法真实购买 | App Store Connect 创建月/年订阅并联调 |

## 建议下一步

1. 先完成 Apple Developer Program 注册。
2. 创建 App Store Connect App：名称、bundle id、SKU、隐私政策 URL。
3. 创建 IAP 产品：月付、年付。
4. 配好生产后端域名和环境变量。
5. 产出第一版 EAS internal build 做真机验收。
