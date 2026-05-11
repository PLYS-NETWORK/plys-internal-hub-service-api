import type {
  ContactEmailStatus,
  ContactInquiry,
  ContactTopic,
} from '@database/entities/contact/contact-inquiry.entity';

export interface IInsertContactInquiryInput {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly topic: ContactTopic;
  readonly message: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface IContactInquiryRepository {
  /** Insert a new inquiry. Returns the persisted row (with the generated id + timestamps). */
  insertInquiry(input: IInsertContactInquiryInput): Promise<ContactInquiry>;

  /**
   * Idempotent compare-and-set on `email_status`:
   *   - notification failure transitions pending → failed_notification, or failed_acknowledgement → failed_both
   *   - acknowledgement failure transitions pending → failed_acknowledgement, or failed_notification → failed_both
   *   - both succeed (called from elsewhere) transitions pending → sent
   * The transition is computed inside the repository so concurrent .catch handlers cannot race.
   */
  markEmailFailure(id: string, kind: 'notification' | 'acknowledgement'): Promise<void>;

  /** Mark email_status = 'sent' (only transitions pending → sent; no-op if anything else). */
  markEmailSent(id: string): Promise<void>;

  /** Read-only — used by tests/admin. */
  findById(id: string): Promise<ContactInquiry | null>;
}

// Re-export the input type for callers that want to import everything from one place.
export type { ContactEmailStatus };
