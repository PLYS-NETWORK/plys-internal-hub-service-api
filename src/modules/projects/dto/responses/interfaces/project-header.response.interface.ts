import { ProjectStatus } from '@database/enums';

export interface IProjectHeaderOwner {
  user_id: string;
  full_name: string;
  /** Two-letter initials derived from `full_name`, uppercased. */
  avatar_initials: string;
}

export interface IProjectHeaderPayment {
  is_paid: boolean;
  /** Fixed-point string ("70.00"); `null` until paid. */
  amount: string | null;
  /** ISO 4217 code; `null` until paid. */
  currency: string | null;
  paid_at: Date | null;
}

export interface IProjectHeaderResponse {
  project_id: string;
  /** Display name. (We keep the field as `title` per platform convention.) */
  title: string;
  /** Rich-text introduction stored as TipTap JSON. `null` if never set. */
  introduction: Record<string, unknown> | null;
  status: ProjectStatus;
  created_at: Date;
  published_at: Date | null;
  updated_at: Date;
  owner: IProjectHeaderOwner;
  payment: IProjectHeaderPayment;
}
