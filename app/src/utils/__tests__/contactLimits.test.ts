import {
  canAddMoreContacts,
  FREE_CONTACT_LIMIT,
  getContactLimit,
  PREMIUM_CONTACT_LIMIT,
} from '../contactLimits';

describe('contactLimits', () => {
  it('enforces one free contact', () => {
    expect(getContactLimit(false)).toBe(FREE_CONTACT_LIMIT);
    expect(canAddMoreContacts(0, false)).toBe(true);
    expect(canAddMoreContacts(1, false)).toBe(false);
  });

  it('enforces five premium contacts', () => {
    expect(getContactLimit(true)).toBe(PREMIUM_CONTACT_LIMIT);
    expect(canAddMoreContacts(4, true)).toBe(true);
    expect(canAddMoreContacts(5, true)).toBe(false);
  });
});
