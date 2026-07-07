import { Platform } from 'react-native';
import type { SubscriptionPlan } from '@/services/api.types';

/**
 * App Store Connect 中配置的产品 ID
 * 上线前需要在 App Store Connect 创建对应订阅产品
 */
export const PRODUCT_IDS: Record<SubscriptionPlan, string> = {
  monthly: 'com.todayok.subscription.monthly',
  yearly: 'com.todayok.subscription.yearly',
};

export const PLAN_DISPLAY: Record<
  SubscriptionPlan,
  {
    name: string;
    price: string;
    period: string;
    tagline: string;
    features: { label: string; included: boolean }[];
  }
> = {
  monthly: {
    name: '守护版 · 月付',
    price: '¥0.9',
    period: '/月',
    tagline: '按月灵活开通',
	    features: [
	      { label: '5 位紧急联系人', included: true },
	      { label: '多联系人告警通知', included: true },
	      { label: '告警语音电话', included: true },
	      { label: '无试用期', included: false },
    ],
  },
  yearly: {
    name: '守护版 · 年付',
    price: '¥9.9',
    period: '/年',
    tagline: '全年守护 · 推荐',
	    features: [
	      { label: '5 位紧急联系人', included: true },
	      { label: '多联系人告警通知', included: true },
	      { label: '告警语音电话', included: true },
	      { label: '7 天免费试用', included: true },
    ],
  },
};

export const IS_IOS = Platform.OS === 'ios';

/**
 * 是否启用 mock 购买（开发环境）
 * 在 __DEV__ 下或显式环境变量开启时，使用本地模拟交易
 */
export const USE_IAP_MOCK = __DEV__;
