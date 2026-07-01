# 今天还好 · 前端（app）

「今天还好」独居守护 App 的前端，基于 **Expo (React Native) + Expo Router**，主打 iOS。

> 后端见仓库根目录的 [`server/`](../server)。整体介绍见[根 README](../README.md)。

## 技术栈

- **Expo 56 / React Native 0.85 / React 19**
- **Expo Router**（文件路由）
- **Zustand**（状态管理，AsyncStorage 持久化）
- **Axios**（含 token 注入 + 401 自动刷新拦截）
- **SSE 实时通道**（`services/realtime.ts`，替代轮询）
- **Apple IAP / StoreKit 2**（订阅，`services/iap*.ts`）

## 目录

```
src/
├── app/            # Expo Router 路由
│   ├── onboarding/ #   注册引导（登录→协议→信息→联系人→提醒→授权→完成）
│   ├── (tabs)/     #   首页(状态机) / 看板 / 设置
│   ├── alert/      #   告警处理
│   ├── guardian/   #   子女端（守护列表 / 看板 / 邀请 / 代确认）
│   ├── subscription/ # 订阅（选择 / 代付 / 成功）
│   └── help/       #   紧急求助
├── store/          # Zustand 全局状态
├── services/       # api / notifications / iap / deepLink / realtime / timezone / errorReporter
├── components/ui/  # 可复用 UI 组件
├── theme/          # 设计 tokens
└── types/          # 领域类型
```

## 开发

```bash
npm install
npx expo start        # 按提示在 iOS 模拟器 / Expo Go 打开
```

常用脚本：

```bash
npm run ios           # 直接开 iOS 模拟器
npm test              # Jest 单元 / 流程集成测试
npx tsc --noEmit      # 类型检查
npm run lint          # ESLint
```

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `EXPO_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:3000/api` |
| `EXPO_PUBLIC_APP_STORE_URL` | App Store 下载链接 | — |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN（可选，配置后启用错误上报） | — |

## 测试

单元 / 流程集成测试位于 `src/**/__tests__`，覆盖 store（100%）、api 拦截器、通知、IAP、深链、SSE 解析、时区、关键用户流程。

> 组件 DOM 渲染 / 真机 E2E：当前 React 19 + jest-expo 环境下 RTL 适配成本较高，真机级 E2E 建议在 Mac + EAS Build 上用 Detox / Maestro 补充。
