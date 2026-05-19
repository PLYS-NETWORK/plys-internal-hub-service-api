import { OnboardingDecision, OnboardingStatus, SkillExamStatus } from '@database/enums';

export interface IConsultantDashboardMoney {
  currency: string;
  /** Account wallet balance (cleared funds available for withdrawal). */
  wallet_balance: string;
  /** Sum of CREDIT_PENDING rows (accrued but not yet released). */
  pending_credits: string;
  /** Sum of CREDIT_CLEARED rows in the current month (COMPLETED only). */
  cleared_credits_mtd: string;
  /** Sum of WITHDRAWAL rows in the current month (COMPLETED only). */
  total_withdrawn_mtd: string;
  /** Sum of CREDIT_CLEARED rows since signup. */
  lifetime_earnings: string;
}

export interface IConsultantDashboardPortfolio {
  active_projects: number;
  total_tasks_in_progress: number;
  total_tasks_in_review: number;
  tasks_completed_mtd: number;
  tasks_overdue: number;
}

export interface IConsultantDashboardPerformance {
  /** `(on_time / total_done) * 100` over MTD; `null` when no qualifying rows. */
  on_time_pct: string | null;
  /** Mean cycle days over DONE rows in MTD; `null` when none. */
  avg_cycle_days: string | null;
  /** Aggregated rating across reviewed deliveries (denormalized on profile). */
  avg_rating: string | null;
  /** Current count of REVISION_REQUESTED tasks owned by the consultant. */
  revisions_requested_count: number;
}

export interface IConsultantDashboardSkills {
  /** Skills with a non-null proficiency_level (i.e. at least one passing exam). */
  verified_skills_count: number;
  expert_count: number;
  senior_count: number;
  intermediate_count: number;
}

export interface IConsultantDashboardExams {
  /** ID of the consultant's currently-active exam, or null. */
  active_exam_id: string | null;
  active_skill_name: string | null;
  active_status: SkillExamStatus | null;
  expires_at: string | null;
  /** Total number of skills the consultant has passed an exam for. */
  total_passed_skills: number;
}

export interface IConsultantDashboardOnboarding {
  /** Null when no onboarding row exists yet (rare — usually created at signup). */
  status: OnboardingStatus | null;
  decision: OnboardingDecision | null;
  blocked_until: string | null;
  is_approved: boolean;
}

export interface IConsultantDashboardActionCounts {
  revision_requested_tasks: number;
  overdue_tasks: number;
  /** Caller-owned tasks in IN_REVIEW or PENDING_APPROVAL (business-side queue). */
  pending_approval_tasks: number;
  unread_notifications: number;
  pending_withdrawals: number;
}

export interface IConsultantDashboardSummaryResponse {
  money: IConsultantDashboardMoney;
  portfolio: IConsultantDashboardPortfolio;
  performance: IConsultantDashboardPerformance;
  skills: IConsultantDashboardSkills;
  exams: IConsultantDashboardExams;
  onboarding: IConsultantDashboardOnboarding;
  action_counts: IConsultantDashboardActionCounts;
  generated_at: string;
}
