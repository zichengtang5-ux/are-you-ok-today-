/**
 * 最小类型声明：react-native-iap 在 __DEV__ 下按需懒加载，未安装时
 * TypeScript 也能识别 API 表面。上线前 `npx expo install react-native-iap`
 * 后该声明会被第三方自带的 @types 覆盖。
 */
declare module 'react-native-iap' {
  export interface IapProduct {
    productId: string;
    localizedPrice?: string;
    currency?: string;
    [k: string]: unknown;
  }

  export interface IapPurchase {
    transactionId?: string;
    productId?: string;
    [k: string]: unknown;
  }

  export function initConnection(): Promise<void>;
  export function endConnection(): Promise<void>;
  export function getProducts(opts: { skus: string[] }): Promise<IapProduct[]>;
  export function requestSubscription(opts: { sku: string }): Promise<IapPurchase>;
  export function finishTransaction(opts: {
    purchase: IapPurchase;
    isConsumable: boolean;
  }): Promise<void>;
}
