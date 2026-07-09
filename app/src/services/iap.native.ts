/**
 * IAP Service — StoreKit 2 封装 (Native)
 *
 * 开发环境（__DEV__ / USE_IAP_MOCK=true）：
 *   纯 mock，不依赖 react-native-iap，Metro 无需解析该模块。
 *
 * 上线前（EAS Build）：
 *   1. `npx expo install react-native-iap`
 *   2. 在 App Store Connect 创建 PRODUCT_IDS 对应的自动续期订阅
 *   3. 无需修改本文件 — 动态 require 在运行时自动加载
 */

import { USE_IAP_MOCK, PRODUCT_IDS } from './iap.config';
import type { SubscriptionPlan } from './api.types';

const _moduleName = 'react-native-iap';
let _RNIap: any = null;
function getRNIap(): any {
  if (!_RNIap) {
    try {
      _RNIap = require(_moduleName);
    } catch {
      throw new Error(
        'react-native-iap 未安装。请运行: npx expo install react-native-iap',
      );
    }
  }
  return _RNIap;
}

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
  await getRNIap().initConnection();
  initialized = true;
}

export async function getProducts(): Promise<ProductPrice[]> {
  if (USE_IAP_MOCK) {
    return [
      { plan: 'monthly', localizedPrice: '¥0.90', currency: 'CNY' },
      { plan: 'yearly', localizedPrice: '¥9.90', currency: 'CNY' },
    ];
  }
  const RNIap = getRNIap();
  const products = await RNIap.getProducts({ skus: Object.values(PRODUCT_IDS) });
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

  const RNIap = getRNIap();
  const purchase = await RNIap.requestSubscription({ sku: productId });
  const transactionId = purchase.transactionId;
  if (!transactionId) throw new Error('StoreKit 未返回 transactionId，请重试');
  await RNIap.finishTransaction({ purchase, isConsumable: false });
  return { transactionId, productId, provider: 'apple' };
}

export async function endIap(): Promise<void> {
  if (USE_IAP_MOCK) return;
  await getRNIap().endConnection();
  _RNIap = null;
  initialized = false;
}
