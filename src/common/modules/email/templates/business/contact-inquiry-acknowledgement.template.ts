import type { ContactTopic } from '@database/entities/contact/contact-inquiry.entity';
import * as ejs from 'ejs';
import * as path from 'path';

export interface IContactInquiryAcknowledgementTemplateOptions {
  readonly name: string;
  readonly topic: ContactTopic;
  readonly topicLabel: string;
}

/**
 * Builds the acknowledgement email sent to the submitter.
 *
 * SECURITY:
 *   - `name` and `topicLabel` are passed to EJS via `<%= %>` (HTML-escaped).
 *   - `topicLabel` is derived from an enum and is safe; `name` is attacker-controlled.
 *   - No `<%- %>` (unescaped output) anywhere in the template.
 */
export async function buildContactInquiryAcknowledgementEmail(
  options: IContactInquiryAcknowledgementTemplateOptions,
): Promise<string> {
  return ejs.renderFile(path.join(__dirname, 'contact-inquiry-acknowledgement.template.ejs'), {
    name: options.name,
    topicLabel: options.topicLabel,
    year: new Date().getFullYear(),
  });
}
