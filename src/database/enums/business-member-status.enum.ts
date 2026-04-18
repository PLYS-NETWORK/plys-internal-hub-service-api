export enum BusinessMemberStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  LEFT = 'left',
}

export const BUSINESS_MEMBER_STATUSES: readonly BusinessMemberStatus[] = [
  BusinessMemberStatus.ACTIVE,
  BusinessMemberStatus.SUSPENDED,
  BusinessMemberStatus.LEFT,
];
