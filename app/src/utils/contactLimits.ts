export const FREE_CONTACT_LIMIT = 1;
export const PREMIUM_CONTACT_LIMIT = 5;

export function getContactLimit(isPremium: boolean): number {
  return isPremium ? PREMIUM_CONTACT_LIMIT : FREE_CONTACT_LIMIT;
}

export function canAddMoreContacts(contactCount: number, isPremium: boolean): boolean {
  return contactCount < getContactLimit(isPremium);
}
