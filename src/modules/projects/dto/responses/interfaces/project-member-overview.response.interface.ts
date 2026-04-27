export type MemberActivityStatus = 'active' | 'idle' | 'offline';

export interface IProjectMemberOverviewResponse {
  user_id: string;
  full_name: string;
  /** Two-letter initials, uppercased. */
  avatar_initials: string;
  joined_at: Date;
  /** Most recent login; `null` if the user has never logged in. */
  last_active_at: Date | null;
  /** Server-derived bucket: `<8h=active`, `8–48h=idle`, `>48h or null=offline`. */
  activity_status: MemberActivityStatus;
}
