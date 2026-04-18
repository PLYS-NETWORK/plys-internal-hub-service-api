// Marketplace roles within a business. `viewer` is the least-privileged tier
// and the safe default for new invites. Fixes the v2 schema nit where the
// default was `'member'` (a value not in the CHECK list).
export enum BusinessMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  BILLING = 'billing',
  VIEWER = 'viewer',
}

export const BUSINESS_MEMBER_ROLES: readonly BusinessMemberRole[] = [
  BusinessMemberRole.OWNER,
  BusinessMemberRole.ADMIN,
  BusinessMemberRole.MANAGER,
  BusinessMemberRole.BILLING,
  BusinessMemberRole.VIEWER,
];
