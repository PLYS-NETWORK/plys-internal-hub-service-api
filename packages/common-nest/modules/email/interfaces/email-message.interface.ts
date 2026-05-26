/**
 * Represents a single outbound email message.
 * Providers receive this normalized shape — they are responsible
 * for translating it into their own SDK's request format.
 */
export interface IEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}
