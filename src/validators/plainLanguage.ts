export const JARGON: Record<string, string> = {
  utilize: 'use', facilitate: 'help', individual: 'person', eligibility: 'who qualifies', 'pursuant to': 'under',
  'in the event that': 'if', 'prior to': 'before', 'subsequent to': 'after', terminate: 'end', commence: 'start',
  ascertain: 'find out', endeavor: 'try', 'in accordance with': 'following', notwithstanding: 'even so',
  aforementioned: 'this', 'in order to': 'to', approximately: 'about', provision: 'rule', constitute: 'count as',
  stipulate: 'require', disseminate: 'share', implement: 'carry out', methodology: 'method', optimal: 'best',
  sufficient: 'enough', requisite: 'needed', remuneration: 'pay', residence: 'home', transmit: 'send', 'interaction between': 'how they affect each other',
};

const PASSIVE = /\b(is|are|was|were|be|been|being)\s+(\w+ed|given|taken|made|done|seen|known|shown|found|held|kept|left|lost|paid|put|read|said|sent|set|told|written|built|bought|caught|chosen|drawn|driven|eaten|fallen|felt|forgotten|frozen|gotten|grown|hidden|hit|hurt|laid|led|lent|let|lit|met|ridden|risen|run|sold|shaken|shot|shut|sung|sat|slept|spoken|spent|stood|stolen|struck|sworn|swept|swum|taught|torn|thrown|understood|woken|worn|won|wound)\b/gi;

function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function sentencesOf(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

export function fleschKincaid(text: string) {
  const sents = sentencesOf(text);
  const words = text.split(/\s+/).filter(Boolean);
  if (!sents.length || !words.length) return 0;
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  return 0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59;
}

export function factsOf(text: string) {
  const numbers = text.match(/\d[\d,.%]*/g) ?? [];
  const names = text.match(/\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) ?? [];
  return new Set([...numbers, ...names]);
}

export function checkPlainRewrite(source: string, rewrite: string): string[] {
  const errors: string[] = [];
  const t = rewrite.trim();
  if (!t) return ['rewrite: write the plain-language version first.'];
  if (t === source.trim()) return ['rewrite: the text is unchanged. Rewrite it in your own words.'];
  const sents = sentencesOf(t);
  const avg = t.split(/\s+/).filter(Boolean).length / Math.max(1, sents.length);
  if (avg > 20) errors.push(`rewrite: average sentence is ${avg.toFixed(0)} words. Keep it under 20. Split long sentences.`);
  const grade = fleschKincaid(t);
  if (grade > 8) errors.push(`rewrite: reading grade is ${grade.toFixed(1)}. Aim for 8 or lower. Use shorter words.`);
  for (const j of Object.keys(JARGON)) {
    if (new RegExp(`\\b${j.replace(/ /g, '\\s+')}\\b`, 'i').test(t)) { errors.push(`rewrite: replace "${j}" with "${JARGON[j]}".`); break; }
  }
  const passive = t.match(PASSIVE);
  if (passive && passive.length > 1) errors.push(`rewrite: ${passive.length} passive phrases, e.g. "${passive[0]}". Say who does the action.`);
  const missing = [...factsOf(source)].filter((f) => !t.includes(f));
  if (missing.length) errors.push(`rewrite: keep "${missing[0]}" from the source. Numbers and names must stay.`);
  return errors;
}
