# 今天还好 · 前端

Expo / React Native iOS App，负责独居用户每日确认、告警处理、子女守护、订阅和紧急求助流程。

## 技术栈

- Expo 56
- React Native 0.85
- React 19
- Expo Router
- Zustand + AsyncStorage
- Axios
- SSE 实时通道
- Expo Notifications
- Expo Location
- react-native-iap / StoreKit 2

## 目录

```text
src/
├── app/              # Expo Router 页面
│   ├── onboarding/   # 注册与引导
│   ├── (tabs)/       # 首页、看板、设置
│   ├── alert/        # 告警联系人处理
│   ├── guardian/     # 子女端守护关系
│   ├── subscription/ # 本人订阅与子女代付
│   └── help/         # 紧急求助
├── components/       # UI 组件
├── services/         # API、SSE、通知、IAP、深链、配置
├── store/            # Zustand 状态
├── theme/            # 设计 token
└── types/            # 领域类型
```

## 本地开发

```bash
npm install
cp .env.example .env
npx expo start
```

常用命令：

```bash
npm run ios
npm test -- --runInBand
npx tsc --noEmit
npm run lint
npx expo-doctor
```

## 环境变量

`.env.example` 是当前模板：

| 变量 | 用途 | 默认行为 |
|------|------|----------|
| `EXPO_PUBLIC_API_URL` | 后端 API 地址 | 不配置时使用 `http://localhost:3000/api` |
| `EXPO_PUBLIC_APP_STORE_URL` | 邀请链接中的 App Store 地址 | 不配置时使用占位 App Store URL |
| `EXPO_PUBLIC_TERMS_URL` | 用户协议 URL | 不配置时设置页会提示未配置 |
| `EXPO_PUBLIC_PRIVACY_URL` | 隐私政策 URL | 不配置时设置页会提示未配置 |
| `EXPO_PUBLIC_SENTRY_DSN` | 前端错误上报 DSN | 空值时不启用 |

真机测试不能使用 `localhost` 访问 Mac 后端，需要改成局域网地址：

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
```

## EAS Build

已提供 `eas.json`：

- `preview`：internal distribution，iOS simulator build
- `production`：App Store production build，自动递增版本号

常用命令：

```bash
npx eas build --platform ios --profile preview
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

生产构建前必须确认：

- Apple Developer Program 已开通
- App Store Connect 已创建 App
- bundle id 与 `app.json` 中的 `com.todayok.app` 一致
- `EXPO_PUBLIC_API_URL` 指向 HTTPS 生产 API
- `EXPO_PUBLIC_TERMS_URL` 和 `EXPO_PUBLIC_PRIVACY_URL` 可公开访问
- App Store Connect 已创建 IAP 订阅产品

## 当前功能

- 手机号验证码登录
- 引导流程：协议、基础信息、联系人、提醒时间、通知授权
- 首页状态机：`idle / waiting / replied / grace / alert / paused`
- 今日确认与告警状态展示
- 紧急联系人告警处理：确认安全、需要帮助、行动建议
- 子女端：创建邀请、接受邀请、守护列表、看板、代确认
- 设置：提醒时间、地址、联系人、暂停/恢复守护、删除账号
- 订阅：本人购买、子女代付、订阅成功页
- 紧急求助：定位、地址回退、通知联系人
- 外部链接：电话、App Store、协议、隐私政策失败兜底
- SSE 实时状态同步

## 验证记录

最近一次完整验证（2026-07-03）：

- `npx tsc --noEmit` 通过
- `npm test -- --runInBand` 通过，10 个 suites / 88 个 tests
- `npm run lint` 0 errors，仍有少量 warnings
- `npx expo install --check` 通过
- `npx expo-doctor` 通过
- `npm audit --audit-level=moderate` 0 vulnerabilities
- `npx expo export --platform ios` 成功
- iPhone 16 Pro / iOS 18.6 模拟器覆盖登录引导、每日签到/撤销、告警确认/求助、SOS、邀请分享、mock 订阅、暂停/恢复、提醒时间预设、电话兜底

## 注意

`app/AGENTS.md` 要求写前端代码前先查 Expo 56 官方文档。升级 Expo 或改原生插件时必须重新验证 `expo-doctor` 和 iOS bundle。

Expo Go 不接管项目自定义 `todayok://` scheme。邀请和告警深链需要用 EAS dev/internal build 在真机验证。
