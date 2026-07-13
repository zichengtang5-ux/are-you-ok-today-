export const FREE_MAX_CONTACTS = 1;
export const PREMIUM_MAX_CONTACTS = 5;

export interface SubscriptionEntitlement {
  status: string;
  currentPeriodEnd?: Date | null;
}

export function hasPremiumEntitlement(
  subscription: SubscriptionEntitlement | null | undefined,
  at = new Date(),
): boolean {
  if (subscription?.status !== 'active' && subscription?.status !== 'trial') return false;
  return !subscription.currentPeriodEnd || subscription.currentPeriodEnd > at;
}

export function limitContactsForSubscription<T>(
  contacts: T[],
  subscription: SubscriptionEntitlement | null | undefined,
  at = new Date(),
): T[] {
  const limit = hasPremiumEntitlement(subscription, at)
    ? PREMIUM_MAX_CONTACTS
    : FREE_MAX_CONTACTS;
  return contacts.slice(0, limit);
}
