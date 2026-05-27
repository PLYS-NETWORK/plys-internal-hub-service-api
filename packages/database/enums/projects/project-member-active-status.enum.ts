export enum ProjectMemberActiveStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  INACTIVE = 'inactive',
}

export const PROJECT_MEMBER_ACTIVE_STATUSES: readonly ProjectMemberActiveStatus[] = [
  ProjectMemberActiveStatus.ACTIVE,
  ProjectMemberActiveStatus.IDLE,
  ProjectMemberActiveStatus.INACTIVE,
];
