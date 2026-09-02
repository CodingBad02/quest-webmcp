import OpeningHours from 'opening_hours';
import type { ContributionPayload } from '../types';

const NOMINATIM = { address: { country_code: 'in', state: 'Karnataka' } } as unknown as ConstructorParameters<typeof OpeningHours>[1];

export function checkOpeningHours(value: string): string | null {
  const v = value.trim();
  if (!v) return 'opening_hours: enter the hours. Example: Mo-Fr 09:00-18:00.';
  try {
    new OpeningHours(v, NOMINATIM, { mode: 0, locale: 'en' } as never);
    return null;
  } catch (e) {
    const msg = String(e).split('\n')[0].replace(/^Error:\s*/, '').slice(0, 120);
    return `opening_hours: could not parse "${v}". ${msg}. Use the form "Mo-Fr 09:00-18:00; Sa 10:00-14:00".`;
  }
}

/** Only verify-hours is validated here: access-photo is Survey's form now (DESIGN.md §7). */
export function validate(p: Extract<ContributionPayload, { kind: 'verify-hours' }>): string[] {
  const errors: string[] = [];
  const e = checkOpeningHours(p.openingHours); if (e) errors.push(e);
  if (!p.verifiedBy) errors.push('verified_by: choose how you checked: phone, visit, or website.');
  if (p.note.trim().length < 10) errors.push('note: add at least 10 characters on how you confirmed the hours.');
  return errors;
}

/** Structural checks only: URL parses and is https, quote is non-empty and bounded, the
 *  checkbox is ticked. Source reachability and claim identity are network checks in
 *  webmcp/tools.ts, shared by the tool and the Check button. */
export function validateCiteClaim(p: Extract<ContributionPayload, { kind: 'cite-claim' }>): string[] {
  const errors: string[] = [];
  let url: URL | null = null;
  try { url = new URL(p.sourceUrl.trim()); } catch { /* not a URL */ }
  if (!url) errors.push('source_url: enter a full URL, e.g. https://example.com/article.');
  else if (url.protocol !== 'https:') errors.push('source_url: use an https link.');
  const quote = p.quote.trim();
  if (!quote) errors.push('quote: say where the source states this, in your own words or verbatim.');
  else if (quote.length > 300) errors.push('quote: keep it under 300 characters.');
  if (!p.confirmed) errors.push('confirmed: check the box once you have read the source and it states this value.');
  return errors;
}
