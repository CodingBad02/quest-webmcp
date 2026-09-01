import OpeningHours from 'opening_hours';
import type { ContributionPayload, Quest } from '../types';
import { checkPlainRewrite } from './plainLanguage';

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

export function validate(quest: Quest, p: ContributionPayload): string[] {
  const errors: string[] = [];
  if (p.kind === 'verify-hours') {
    const e = checkOpeningHours(p.openingHours); if (e) errors.push(e);
    if (!p.verifiedBy) errors.push('verified_by: choose how you checked: phone, visit, or website.');
    if (p.note.trim().length < 10) errors.push('note: add at least 10 characters on how you confirmed the hours.');
  } else if (p.kind === 'access-photo') {
    if (!p.imageDataUrl) errors.push('photo: attach a photo of the entrance.');
    else if (!p.imageDataUrl.startsWith('data:image/')) errors.push('photo: the file is not an image.');
    else if (p.imageDataUrl.length > 2_000_000) errors.push('photo: image too large after resize. Try a smaller photo.');
    if (!p.wheelchair) errors.push('wheelchair: choose yes, limited, or no.');
    if (p.wheelchair === 'limited' && p.note.trim().length < 10) errors.push('note: explain what limits access, in at least 10 characters.');
  } else if (p.kind === 'plain-rewrite') {
    errors.push(...checkPlainRewrite(quest.sourceText ?? '', p.rewrittenText));
  }
  return errors;
}
