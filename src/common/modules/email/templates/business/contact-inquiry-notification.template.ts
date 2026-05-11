import type { ContactTopic } from '@database/entities/contact/contact-inquiry.entity';
import * as ejs from 'ejs';
import * as path from 'path';

export interface IContactInquiryNotificationTemplateOptions {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly topic: ContactTopic;
  readonly topicLabel: string;
  readonly message: string;
  readonly submittedAt: Date;
  readonly ipAddress: string | null;
}

/**
 * Builds the internal-team notification email body for a contact inquiry.
 *
 * SECURITY:
 *   - All submitter-supplied fields (name, email, company, message, topic)
 *     are passed to the EJS template via `<%= %>` (HTML-escaping output).
 *   - The message body is HTML-escaped HERE and newlines are converted to
 *     <br /> before being passed to the template as `messageHtml`, then
 *     rendered via `<%- messageHtml %>`. This is the only legitimate use
 *     of unescaped EJS output in this template.
 */
export async function buildContactInquiryNotificationEmail(
  options: IContactInquiryNotificationTemplateOptions,
): Promise<string> {
  const messageHtml = escapeHtml(options.message).replace(/\r?\n/g, '<br />');

  return ejs.renderFile(path.join(__dirname, 'contact-inquiry-notification.template.ejs'), {
    name: options.name,
    email: options.email,
    company: options.company,
    topicLabel: options.topicLabel,
    messageHtml,
    submittedAt: options.submittedAt.toISOString(),
    ipAddress: options.ipAddress ?? 'unknown',
    year: new Date().getFullYear(),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
