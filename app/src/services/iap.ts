/**
 * IAP Service — Expo Go / Web / Test 桩
 *
 * 真实 StoreKit 2 集成在 iap.native.ts（仅原生 EAS 构建时使用）。
 * 这里提供不依赖 `react-native-iap` 的实现，保证 Metro 在 Expo Go
 * （原生模块不可用）和 web 环境下能正常打包。
 *
 * Mock 模式（USE_IAP_MOCK=true）默认开启，订阅流程无需真 IAP。
 */

import { USE_IAP_MOCK, PRODUCT_IDS } from './iap.config';
import type { SubscriptionPlan } from './api.types';

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

export async function initIap(): Promise<void> {
  // Expo Go / Web 下没有 StoreKit，只能走 mock
  if (!USE_IAP_MOCK) {
    throw new Error('Expo Go / Web 不支持真实 IAP，请使用 EAS Build 构建');
  }
}

export async function getProducts(): Promise<ProductPrice[]> {
  return [
    { plan: 'monthly', localizedPrice: '¥0.90', currency: 'CNY' },
    { plan: 'yearly', localizedPrice: '¥9.90', currency: 'CNY' },
  ];
}

export async function purchasePlan(plan: SubscriptionPlan): Promise<PurchaseResult> {
  const productId = PRODUCT_IDS[plan];
  if (!USE_IAP_MOCK) {
    throw new Error('Expo Go / Web 不支持真实 IAP，请使用 EAS Build 构建');
  }
  await new Promise((r) => setTimeout(r, 600));
  return {
    transactionId: `mock-${plan}-${Date.now()}`,
    productId,
    provider: 'apple',
  };
}

export async function endIap(): Promise<void> {
  // no-op on Expo Go / Web
}
