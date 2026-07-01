/**
 * iap.ts (Expo Go/测试桩) + iap.config 测试。
 * 测试环境 __DEV__=true → USE_IAP_MOCK=true，走 mock 分支。
 */
import { initIap, getProducts, purchasePlan, endIap } from '../iap';
import { PRODUCT_IDS, PLAN_DISPLAY } from '../iap.config';

describe('iap.config', () => {
  it('defines product IDs for both plans', () => {
    expect(PRODUCT_IDS.monthly).toBe('com.todayok.subscription.monthly');
    expect(PRODUCT_IDS.yearly).toBe('com.todayok.subscription.yearly');
  });
  it('yearly plan offers a free trial, monthly does not', () => {
    const yearlyTrial = PLAN_DISPLAY.yearly.features.find((f) => f.label.includes('试用'));
    const monthlyTrial = PLAN_DISPLAY.monthly.features.find((f) => f.label.includes('试用'));
    expect(yearlyTrial?.included).toBe(true);
    expect(monthlyTrial?.included).toBe(false);
  });
});

describe('iap service (mock mode)', () => {
  it('initIap resolves in mock mode', async () => {
    await expect(initIap()).resolves.toBeUndefined();
  });

  it('getProducts returns both plans with prices', async () => {
    const products = await getProducts();
    expect(products.map((p) => p.plan).sort()).toEqual(['monthly', 'yearly']);
    products.forEach((p) => expect(p.currency).toBe('CNY'));
  });

  it('purchasePlan returns a mock transaction with correct productId', async () => {
    jest.useFakeTimers();
    const promise = purchasePlan('monthly');
    jest.runAllTimers();
    const result = await promise;
    expect(result.productId).toBe(PRODUCT_IDS.monthly);
    expect(result.provider).toBe('apple');
    expect(result.transactionId).toContain('mock-monthly-');
    jest.useRealTimers();
  });

  it('endIap is a no-op that resolves', async () => {
    await expect(endIap()).resolves.toBeUndefined();
  });
});
