/**
 * IAP Service — StoreKit 2 封装 (Native)
 *
 * 开发环境（__DEV__ / USE_IAP_MOCK=true）：
 *   纯 mock，不依赖 react-native-iap，Metro 无需解析该模块。
 *
 * 上线前（EAS Build）：
 *   1. `npx expo install react-native-iap`
 *   2. 取消下方 REAL_IAP 的注释
 *   3. 在 App Store Connect 创建 PRODUCT_IDS 对应的自动续期订阅
 */

import { USE_IAP_MOCK, PRODUCT_IDS } from './iap.config';
import type { SubscriptionPlan } from './api.types';

// ── Production IAP (uncomment for EAS Build) ──────────────────────
// import * as RNIap from 'react-native-iap';

export interface PurchaseResult {
  transactionId: string;
  productId: string;
  provider: 'apple';
}

export interface ProductPrice {
  plan: SubscriptionPlan;
  localizedPrice: string;
  currency: string;
}

let initialized = false;

export async function initIap(): Promise<void> {
  if (initialized) return;
  if (USE_IAP_MOCK) {
    initialized = true;
    return;
  }
  // Production: uncomment below when react-native-iap is installed
  // await RNIap.initConnection();
  throw new Error('真实 IAP 未启用。请先安装 react-native-iap 并取消 iap.native.ts 中的注释。');
}

export async function getProducts(): Promise<ProductPrice[]> {
  if (USE_IAP_MOCK) {
    return [
      { plan: 'monthly', localizedPrice: '¥0.90', currency: 'CNY' },
      { plan: 'yearly', localizedPrice: '¥9.90', currency: 'CNY' },
    ];
  }
  // Production: uncomment below
  // const products = await RNIap.getProducts({ skus: Object.values(PRODUCT_IDS) });
  // return products.map((p: any) => {
  //   const plan = (Object.entries(PRODUCT_IDS).find(
  //     ([, id]) => id === p.productId,
  //   )?.[0] ?? 'monthly') as SubscriptionPlan;
  //   return {
  //     plan,
  //     localizedPrice: p.localizedPrice ?? '',
  //     currency: p.currency ?? 'CNY',
  //   };
  // });
  throw new Error('真实 IAP 未启用');
}

export async function purchasePlan(plan: SubscriptionPlan): Promise<PurchaseResult> {
  const productId = PRODUCT_IDS[plan];

  if (USE_IAP_MOCK) {
    await new Promise((r) => setTimeout(r, 600));
    return {
      transactionId: `mock-${plan}-${Date.now()}`,
      productId,
      provider: 'apple',
    };
  }

  // Production: uncomment below
  // const purchase = await RNIap.requestSubscription({ sku: productId });
  // const transactionId = purchase.transactionId;
  // if (!transactionId) throw new Error('StoreKit 未返回 transactionId，请重试');
  // await RNIap.finishTransaction({ purchase, isConsumable: false });
  // return { transactionId, productId, provider: 'apple' };
  throw new Error('真实 IAP 未启用');
}

export async function endIap(): Promise<void> {
  if (USE_IAP_MOCK) return;
  // Production: uncomment below
  // await RNIap.endConnection();
  initialized = false;
}
