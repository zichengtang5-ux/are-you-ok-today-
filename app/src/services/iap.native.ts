/**
 * IAP Service — StoreKit 2 封装
 *
 * 职责：
 *   1. 初始化 StoreKit（iOS）/ Google Play（Android，预留）
 *   2. 查询已配置产品的最新价格（来自 App Store Connect，避免硬编码）
 *   3. 发起购买并返回 transactionId
 *
 * Mock 模式（USE_IAP_MOCK=true）：
 *   - 开发环境默认开启，无需 StoreKit 配置即可联调订阅流程
 *   - 返回形如 StoreKit 的 purchase 对象（含 transactionId）
 *
 * 上线前：
 *   1. `npx expo install react-native-iap`
 *   2. 使用 EAS Build 构建原生包（IAP 不支持 Expo Go）
 *   3. 在 App Store Connect 创建 PRODUCT_IDS 对应的自动续期订阅
 */

import { USE_IAP_MOCK, PRODUCT_IDS } from './iap.config';
import type { SubscriptionPlan } from './api.types';

export interface PurchaseResult {
  transactionId: string;
  productId: string;
  /** mock 模式固定返回 "apple"；真实模式从 StoreKit 获取 */
  provider: 'apple';
}

export interface ProductPrice {
  plan: SubscriptionPlan;
  /** 本地化价格字符串，如 "¥9.90" */
  localizedPrice: string;
  /** 币种代码，如 "CNY" */
  currency: string;
}

let iapModulePromise: Promise<any> | null = null;

async function loadIapModule() {
  if (USE_IAP_MOCK) return null;
  if (iapModulePromise) return iapModulePromise;
  // String concatenation prevents Metro from resolving the module name at
  // bundle time — Expo Go does not ship this native module. Real EAS builds
  // must install it via `npx expo install react-native-iap`.
  const iapModuleName = ['react-native-iap'].join('');
  iapModulePromise = Promise.resolve()
    .then(() => require(iapModuleName))
    .catch((err: Error) => {
      throw new Error(
        `react-native-iap 未安装。请先执行 \`npx expo install react-native-iap\` 后使用 EAS Build 构建。原始错误：${err.message}`,
      );
    });
  return iapModulePromise;
}

let initialized = false;

/**
 * 初始化 IAP 连接（必须在 App 启动时调用一次）
 */
export async function initIap(): Promise<void> {
  if (initialized || USE_IAP_MOCK) {
    initialized = true;
    return;
  }
  const iap = await loadIapModule();
  await iap.initConnection();
  initialized = true;
}

/**
 * 查询产品最新价格
 */
export async function getProducts(): Promise<ProductPrice[]> {
  if (USE_IAP_MOCK) {
    return [
      { plan: 'monthly', localizedPrice: '¥0.90', currency: 'CNY' },
      { plan: 'yearly', localizedPrice: '¥9.90', currency: 'CNY' },
    ];
  }
  const iap = await loadIapModule();
  const products = await iap.getProducts({
    skus: Object.values(PRODUCT_IDS),
  });
  return products.map((p: any) => {
    const plan = (Object.entries(PRODUCT_IDS).find(
      ([, id]) => id === p.productId,
    )?.[0] ?? 'monthly') as SubscriptionPlan;
    return {
      plan,
      localizedPrice: p.localizedPrice ?? '',
      currency: p.currency ?? 'CNY',
    };
  });
}

/**
 * 发起购买
 * @throws Error 用户取消 / 购买失败 / 未拿到 transactionId
 */
export async function purchasePlan(plan: SubscriptionPlan): Promise<PurchaseResult> {
  const productId = PRODUCT_IDS[plan];

  if (USE_IAP_MOCK) {
    // 模拟购买延迟
    await new Promise((r) => setTimeout(r, 600));
    return {
      transactionId: `mock-${plan}-${Date.now()}`,
      productId,
      provider: 'apple',
    };
  }

  const iap = await loadIapModule();
  // iOS 通过 requestSubscription 发起自动续期订阅购买
  const purchase = await iap.requestSubscription({ sku: productId });
  const transactionId = purchase.transactionId;
  if (!transactionId) {
    throw new Error('StoreKit 未返回 transactionId，请重试');
  }
  // 购买完成后 finishTransaction，告知 StoreKit 已处理（避免重复扣款）
  await iap.finishTransaction({ purchase, isConsumable: false });
  return {
    transactionId,
    productId,
    provider: 'apple',
  };
}

/**
 * 断开连接（App 卸载 / 登出时调用）
 */
export async function endIap(): Promise<void> {
  if (USE_IAP_MOCK) return;
  const iap = await loadIapModule();
  await iap.endConnection();
  initialized = false;
}
