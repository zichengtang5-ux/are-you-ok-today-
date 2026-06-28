# 项目状态总览 — 今天还好 App

> 维护人：后端
> 最后更新：2026-06-28
> 前端当前分支：feat/ux-improvements-20260627
> 后端当前分支：main (5b5bf05)
> 本文档持续更新，所有后端协作记录、前端进度和上线前事项均集中于此。

---

## 一、后端协作记录

### 1.1 后端已确认的 Bug（需后端修复）

| # | 严重度 | 问题 | 文件 | 影响 | 状态 |
|---|--------|------|------|------|------|
| BUG-1 | P0 | `GET /reply/status` 不检查暂停过期 | `reply.service.ts:104-146` | 暂停到期后 status 卡在 `'paused'` | **已修复**（PR #16） |
| BUG-2 | P1 | `DELETE /reply/today` 撤回不恢复告警 | `reply.service.ts:80-102` | 撤回后告警仍是 resolved | **已修复**（PR #16） |
| BUG-3 | P1 | 切换设备不清理旧 token | `device.service.ts` | 旧设备仍收到推送 | **已修复**（PR #16） |
| BUG-4 | P2 | `DELETE /user/account` VerificationCode 清理 bug | `user.controller.ts:76` | phone 字段匹配错误 | **已修复**（PR #16） |

### 1.2 B 类契约确认（B1-B9）

| # | 问题 | 后端回复 | 前端需改动 | 状态 |
|---|------|---------|-----------|------|
| B1 | `GET /reply/status` 是否原生返回 `paused` | 是，直接返回 `'paused'`。暂停过期检查已修入 `/reply/status`（BUG-1） | 无需改动 | ✅ 已完成 |
| B2 | `POST /reply/today` 在 `paused` 状态下行为 | 改为返回 `409 Conflict`，响应体：`{ statusCode: 409, message: "守护已暂停，请先恢复守护" }` | **需要**：api.ts 拦截器处理 409，引导用户恢复守护 | ⬜ 待前端接入 |
| B3 | `GET /alert/active` 用户自己查看时返回 | 新增接口。返回活跃告警详情（id, triggeredAt, contactsNotified, timeline），无活跃告警返回 `null` | **需要**：api.types.ts 补类型，首页 alert 态接入展示 | ⬜ 待前端接入 |
| B4 | `POST /device/register` 幂等性 | 改为单设备模式，注册时自动清理旧 token | 无需改动，保持现有注册逻辑 | ✅ 已完成 |
| B5 | `DELETE /user/account` 清理范围 | 方案 A：保留联系人条目，标记 `isAccountDeleted: true`，phone 脱敏。Schema 新增字段 | 删除账号前展示关联告知（已有 UI） | ⬜ 待联调 |
| B6 | `POST /guardian/wards/:id/proxy-reply` 权限 | 新增 `isBound` 校验，未绑定返回 403 | 保险起见 catch 处理 403 | ⬜ 待前端处理 |
| B7 | `GET /guardian/wards/:id/dashboard` 免费降级字段 | 确认返回 `null`（recentDays/monthlyStats/history），不是字段缺失 | 类型定义已正确 | ✅ 已完成 |
| B8 | `GET /subscription/status` 过期自动清理 | 实时判定（懒标记），非定时任务。Dashboard 立即降级 | 无需改动 | ✅ 已完成 |
| B9 | `POST /pause` 天数上限 | 后端严格校验 1-30，返回 400 | 前端 UI 已限制 | ✅ 已完成 |

### 1.3 N 类新增/调整接口（N1-N5）

| # | 问题 | 后端回复 | 前端需改动 | 状态 |
|---|------|---------|-----------|------|
| N1 | 首页"撤销回复"能力 | `DELETE /reply/today` 已实现。撤销后 status 按时间判定：窗口内→`waiting`，窗口后→`grace`（自动创建新告警） | 撤销后刷新 `/reply/status`，按新 status 切换首页 | ⬜ 待前端接入 |
| N2 | 子女端状态刷新机制 | Phase 1 用 pull 模型，30 秒轮询，后端无频率限制 | 前端实现轮询（已有） | ✅ 已完成 |
| N3 | 联系人更新手机号后 verified 重置 | 是，`verified` 自动变 `false`。前端不改手机号时不传 phone 字段 | 无需改动 | ✅ 已完成 |
| N4 | 守护暂停恢复 API | `POST /pause/resume` 直接恢复，返回 `guardStatus: 'idle'` | 首页 paused 卡片已接入 | ✅ 已完成 |
| N5 | 删除账号前关联告知 | `/auth/me` 返回 `guardianOf`/`wardOf` 嵌套结构。前端需适配 `ward.nickname` → `wardName`，`ward.phone` → `wardPhone` | 前端适配返回结构 | ⬜ 待前端适配 |

### 1.4 D 类设计决策（D1-D5）

| # | 决策 | 后端回复 | 前端需改动 | 状态 |
|---|------|---------|-----------|------|
| D1 | 首页告警态"需要帮助"入口 | 后端 `POST /help/emergency` 已就绪 | 前端 alert 态增加副按钮（已有 UI） | ✅ 已完成 |
| D2 | 紧急求助页地址来源 | 自动用 GPS，GPS 失败回退 `GET /help/address` | 已实现 | ✅ 已完成 |
| D3 | 子女代付订阅入口 | 复用 `GET /guardian/wards` 过滤 `isBound: true` | 前端过滤逻辑已实现 | ✅ 已完成 |
| D4 | "消息推送未授权"提示策略 | 纯前端逻辑：idle + replied 时显示，alert/grace 时不显示 | 已实现 | ✅ 已完成 |
| D5 | 看板页"本月平安 X/Y 天"计算 | `monthlyStats` 含 repliedDays/totalDays/display，Y 为当月总天数 | 前端用 `display` 字段即可 | ✅ 已完成 |

### 1.5 后端工时评估汇总

| 项 | 预估 | 备注 |
|----|------|------|
| BUG-1/2/3/4 | 0.85 天 | 全部已修复（PR #16） |
| B2 (409) | 0.25 天 | 已修复（PR #16） |
| B3 (新接口) | 0.5 天 | 已修复（PR #16） |
| B5 (删除级联) | 0.5 天 | 已修复（PR #16） |
| B6 (isBound 校验) | 0.1 天 | 已修复（PR #16） |
| N1 (撤销 status) | 0.25 天 | 已修复（PR #16） |
| **合计** | **2.5 天** | PR #16 已提交 |

### 1.6 后端 PR 状态

- **PR #16**：后端对齐 PR — ✅ 已合入 (4b8fb9a)
- **PR #17**：文档对齐 — ✅ 已合入 (4232850)
- **PR #18**：GitHub Actions CI — ✅ 已合入 (812f524)
- **PR #19**：Docker 部署基础设施 — ✅ 已合入 (753a385)
- **PR #22**：真实服务集成（阿里云 SMS + APNs + Apple IAP）— ✅ 已合入 (5b5bf05)

---

## 二、后端合入后前端需新增的类型定义

```typescript
// 新增 — GET /api/alert/active
interface ActiveAlertResponse {
  id: string;
  triggeredAt: string;
  lastReplyAt: string | null;
  contactsNotified: Array<{ id: string; name: string; phone: string }>;
  timeline: Array<{ time: string; action: string; isCurrent?: boolean }>;
}
// 返回 null | ActiveAlertResponse

// 已有但确认 — DELETE /reply/today
// guardStatus 现在可能是 'waiting' | 'grace'（之前只有 'waiting'）
interface UndoReplyResponse {
  message: string;
  guardStatus: 'waiting' | 'grace';
}

// 已有但确认 — POST /reply/today 错误处理
// 新增 409 Conflict 情况
// { statusCode: 409, message: "守护已暂停，请先恢复守护", error: "Conflict" }
```

---

## 三、前端整体进度

### 3.1 已完成的页面/功能（56 个源文件）

#### 核心框架
- [x] Expo Router 文件路由 + Tab 导航
- [x] Zustand 状态管理 + AsyncStorage 持久化
- [x] Axios API 客户端（自动 token 刷新、401 拦截）
- [x] 13 个可复用 UI 组件（Button, Card, Input, Dialog, Banner, Timeline, PlanCard, States, MascotLogo, StepDots, GreenStatusBar, ErrorBoundary）
- [x] 主题系统（Colors, FontSizes, Spacing, Radius, Shadows）

#### 引导流程（7 步）
- [x] 登录（手机号 + 验证码）
- [x] 用户协议
- [x] 基本信息
- [x] 联系人设置
- [x] 提醒时间设置
- [x] 通知授权
- [x] 完成页

#### 首页（状态机）
- [x] idle / waiting / replied / grace / alert / paused 六种状态
- [x] 确认平安按钮
- [x] 撤销回复已移除（按产品决策）
- [x] 告警态"需要帮助"入口

#### 守护功能
- [x] 守护中心列表
- [x] 添加守护（生成邀请码/链接）
- [x] 接受邀请
- [x] 守护看板（wardId 详情页）
- [x] 代确认回复

#### 设置
- [x] 设置主页
- [x] 编辑提醒时间（自定义 ScrollPicker）
- [x] 编辑住址
- [x] 编辑紧急联系人
- [x] 暂停守护
- [x] 删除账号确认

#### 订阅
- [x] 订阅选择页
- [x] 代付订阅页
- [x] 购买成功页
- [x] IAP Mock 模式（开发环境）

#### 紧急求助
- [x] 紧急求助页（GPS 定位 + 地址回退）
- [x] 告警联系人页

### 3.2 本轮（当前分支）已完成的改动

| 改动 | 文件 | 说明 |
|------|------|------|
| 修复 TabBar | `(tabs)/_layout.tsx` | 图标+样式对齐设计稿 |
| Auth 登出+删除账号 | `_layout.tsx`, `settings.tsx` | 接入真实 API |
| 真实 Dashboard 数据 | `dashboard.tsx` | 接入 guardian API |
| 暂停守护页 | `settings/pause-settings.tsx` | 新增页面 |
| 可编辑提醒时间 | `edit-reminder.tsx` | 自定义 ScrollPicker |
| 可编辑住址 | `settings/edit-address.tsx` | 新增页面 |
| GPS 定位 | `help/emergency.tsx` | 真实 GPS + 地址回退 |
| 设置页去重 | `settings.tsx` | 合并重复项 |
| 撤销回复 UI 移除 | `(tabs)/index.tsx` | 按产品决策移除 |
| 无障碍增强 | Button.tsx + 多个页面 | accessibilityRole/Label/Hint |
| App Store URL 可配置 | `guardian/create.tsx` | EXPO_PUBLIC_APP_STORE_URL |
| 版本号动态化 | `settings.tsx` | 读 Constants.expoConfig.version |
| App 图标更新 | `assets/images/` | icon/favicon/splash 更新 |
| 清理废弃组件 | 删除 ConfirmButton/StatusIllustration/StreakBadge/Tag/mock.ts | 代码清理 |

### 3.3 验证状态

| 检查项 | 状态 | 说明 |
|--------|------|------|
| TypeScript 编译 | ✅ 通过 | 类型审计无错误（tsc 无法运行，已手动交叉验证） |
| 模拟器运行 | ✅ 正常 | iPhone 17 Pro (5B630364) |
| TODO/FIXME/HACK | ✅ 零残留 | 代码库无遗留标记 |
| P0 前端类型对齐 | ✅ 完成 | ActiveAlertResponse/UndoReplyResponse/GuardianOf 类型已全部与后端对齐 |

---

## 四、上线前必做事项（Pre-launch Checklist）

### P0 — 阻塞上线

| # | 事项 | 负责方 | 状态 | 备注 |
|---|------|--------|------|------|
| P0-1 | 后端 PR #16 review + 合入 | 后端 | ✅ 已合入 | 4 bug + 5 契约变更 |
| P0-2 | 前端接入 `POST /reply/today` 409 处理 | 前端 | ✅ 已完成 | `index.tsx` handleReply 已处理 409，引导恢复守护 |
| P0-3 | 前端接入 `GET /alert/active` 展示告警详情 | 前端 | ✅ 已完成 | 类型已修正（移除 smsRounds，lastReplyAt 可空），首页已接入 |
| P0-4 | 前端处理 `DELETE /reply/today` 新 status（waiting/grace） | 前端 | ✅ 已完成 | UndoReplyResponse 类型已修正，store undoReply 参数化 |
| P0-5 | 前端处理 proxy-reply 403 错误 | 前端 | ✅ 已完成 | dashboard.tsx + [wardId].tsx 均增加 403 特判 |
| P0-6 | 前端适配 `/auth/me` 中 guardianOf/wardOf 嵌套结构 | 前端 | ✅ 已完成 | 新增 GuardianRelationResponse/WardOfResponse 类型，_layout.tsx 映射正确 |

### P1 — 上线前必须

| # | 事项 | 负责方 | 状态 | 备注 |
|---|------|--------|------|------|
| P1-1 | EAS Build 配置 | 前端 | ⬜ 待做 | 创建 eas.json，配置 profile |
| P1-2 | 安装 react-native-iap + 取消注释生产代码 | 前端 | ⬜ 待做 | `iap.native.ts` 中 production 代码块 |
| P1-3 | App Store Connect 配置订阅产品 | 产品/运营 | ⬜ 待做 | `com.todayok.subscription.monthly` + `yearly` |
| P1-4 | 环境变量配置 | 前端 | ⬜ 待做 | `EXPO_PUBLIC_APP_STORE_URL`, `EXPO_PUBLIC_API_URL` 等 |
| P1-5 | 用户协议 + 隐私政策真实 URL | 产品/法务 | ⬜ 待做 | 当前为 Alert 占位，需替换为真实 WebView 链接 |
| P1-6 | 推送通知 token 上报确认 | 前端 | ⬜ 待做 | 确认 `POST /device/register` 在启动+token 变化时调用 |

### P2 — 上线后尽快

| # | 事项 | 负责方 | 状态 | 备注 |
|---|------|--------|------|------|
| P2-1 | App Store 审核提交 | 运营 | ⬜ 待做 | 需 EAS Build 产出 ipa |
| P2-2 | S6 订阅付费全流程联调 | 前端+后端 | ⬜ 待做 | 真实 StoreKit 2 购买 → 后端 verify |
| P2-3 | WebSocket/SSE push（Phase 2） | 后端 | ⬜ 待规划 | 替代 30 秒轮询 |
| P2-4 | 短信真实集成 | 后端 | ✅ 已完成 | 阿里云 SMS SDK（PR #22 已合入） |
| P2-5 | APNs 真实推送 | 后端 | ✅ 已完成 | apn 包集成（PR #22 已合入） |

---

## 五、环境变量清单

| 变量名 | 用途 | 当前默认值 | 生产值 |
|--------|------|-----------|--------|
| `EXPO_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:3000/api` | 待定（生产服务器地址） |
| `EXPO_PUBLIC_APP_STORE_URL` | App Store 下载链接 | `https://apps.apple.com/app/today-ok` | 真实 App Store URL |

> 注意：目前项目中没有 `.env` 文件，API base URL 硬编码在 `services/api.ts` 中。建议创建 `.env` 和 `.env.production` 文件管理环境变量。

---

## 六、关键文件索引

| 文件 | 用途 |
|------|------|
| `app/src/services/api.ts` | Axios 客户端，token 刷新，401 拦截 |
| `app/src/services/api.types.ts` | 所有 API 请求/响应类型定义（457 行） |
| `app/src/services/iap.native.ts` | StoreKit 2 封装（production 代码已注释） |
| `app/src/services/iap.config.ts` | IAP 产品 ID + 计划配置 |
| `app/src/store/useStore.ts` | Zustand 全局状态 |
| `app/src/types/index.ts` | 核心领域类型 |
| `app/src/theme/index.ts` | 设计 tokens |
| `app/src/components/ui/index.ts` | UI 组件 barrel export |
| `BACKEND-ALIGNMENT-REPLY.md` | 后端逐项回复原文 |
| `HANDOFF-TO-FRONTEND.md` | 后端交接给前端的摘要 |
| `server/PLANNING-SPEC-backend-alignment.md` | 后端实现规划 |
| `PROJECT-STATUS.md` | **本文档** |

---

## 七、待确认的开放问题

| # | 问题 | 决策方 | 状态 |
|---|------|--------|------|
| Q1 | 撤销回复时如果已触发告警，是创建新告警还是重新打开旧告警？ | 产品 | 后端已决策：创建新告警（保留审计轨迹） |
| Q2 | `isAccountDeleted` 联系人 UI 如何展示？ | 产品 | 待定 |
| Q3 | 首页告警态"我需要帮助"入口的最终 UI 设计 | 产品 | 前端已有初步实现 |
| Q4 | App Store Connect 产品 ID 是否已创建？ | 运营 | 待确认 |
| Q5 | 生产环境 API 服务器地址 | 运维 | 待确定 |

---

## 八、建议的推进顺序

1. **前端 P1 第 1 批（0.5 天）**：P1-1 EAS Build 配置 + P1-4 环境变量
2. **前端 P1 第 2 批（0.5 天）**：P1-2 IAP 生产代码 + P1-6 推送 token 确认
3. **前端 P1 第 3 批**：P1-3 App Store Connect + P1-5 协议 URL（需产品/法务）
4. **联调**：前后端全流程联调（需生产凭证：阿里云 SMS、APNs、Apple IAP）
5. **提交审核**：EAS Build 产出 ipa → App Store Connect 提交

---

*本文档由后端维护，每次有重要进展时更新。*
