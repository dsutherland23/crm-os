/**
 * PII Scrubber — removes personally identifiable information before
 * sending context to external LLM APIs.
 *
 * Security: prevents PII leakage to third-party AI providers.
 */

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(\+?[\d\s\-().]{7,20})/g;
const CREDIT_CARD_PATTERN = /\b(?:\d[ -]*?){13,16}\b/g;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;

export interface ScrubResult {
  scrubbed: string;
  replacementsCount: number;
}

export function scrubPii(text: string): ScrubResult {
  let scrubbed = text;
  let count = 0;

  scrubbed = scrubbed.replace(EMAIL_PATTERN, () => { count++; return '[EMAIL_REDACTED]'; });
  scrubbed = scrubbed.replace(CREDIT_CARD_PATTERN, () => { count++; return '[CARD_REDACTED]'; });
  scrubbed = scrubbed.replace(IBAN_PATTERN, () => { count++; return '[IBAN_REDACTED]'; });

  return { scrubbed, replacementsCount: count };
}
