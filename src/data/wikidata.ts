import type { Campaign, Quest } from '../types';
import fallback from './fallbackWikidata.json';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const CACHE_KEY = 'quest.wikidata.v1';
const TTL = 24 * 3600 * 1000;
/** How many curated statements the sky-equivalent panel bounds discovery to (mirrors overpass.ts's buildCampaigns slices). */
const CAMPAIGN_SIZE = 20;

// Reviewed SPARQL template (SPEC.md): curated existing statements around Bengaluru that carry
// no reference yet. `prov:wasDerivedFrom` is how a statement's reference shows up in the RDF.
const QUERY = `SELECT ?item ?itemLabel ?prop ?propLabel ?value ?statement WHERE {
  ?item wdt:P131 wd:Q1355.
  { ?item p:P571 ?statement. ?statement ps:P571 ?value. BIND(wd:P571 AS ?prop) }
  UNION { ?item p:P1128 ?statement. ?statement ps:P1128 ?value. BIND(wd:P1128 AS ?prop) }
  UNION { ?item p:P2196 ?statement. ?statement ps:P2196 ?value. BIND(wd:P2196 AS ?prop) }
  FILTER NOT EXISTS { ?statement prov:wasDerivedFrom ?ref }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 40`;

interface Binding {
  item: { value: string };
  itemLabel: { value: string };
  prop: { value: string };
  propLabel: { value: string };
  value: { value: string; datatype?: string };
  statement: { value: string };
}
interface Response { results: { bindings: Binding[] } }

/** Wikidata labels and URIs are public free text. Strip control characters and cap length. */
function clean(s: string, max = 80) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max);
}

function lastSegment(uri: string) { return uri.slice(uri.lastIndexOf('/') + 1); }

/** Dates render as a bare year (`1994`), matching the value a person actually reads on a source
 *  page. Every other datatype (quantities, e.g. employee counts) renders as-is. */
function valueTextFrom(datatype: string | undefined, raw: string): string {
  if (datatype?.includes('dateTime')) {
    const m = raw.match(/^(-?\d{4,})-\d{2}-\d{2}/);
    if (m) return m[1];
  }
  return raw;
}

function toQuest(b: Binding): Quest {
  const entityId = lastSegment(b.item.value);
  const property = lastSegment(b.prop.value);
  const statementId = b.statement.value.includes('/statement/') ? b.statement.value.split('/statement/')[1] : lastSegment(b.statement.value);
  const itemLabel = clean(b.itemLabel.value, 80);
  const propertyLabel = clean(b.propLabel.value, 40);
  const valueRaw = b.value.value;
  const valueText = clean(valueTextFrom(b.value.datatype, valueRaw), 40);
  return {
    id: `wd_${entityId}_${property}`,
    type: 'cite-claim',
    title: clean(`Find a source: ${itemLabel}, ${propertyLabel}`, 120),
    placeName: itemLabel,
    sourceTags: {},
    estimatedMinutes: 10,
    requiredSkills: ['research'],
    languages: ['English'],
    remote: true,
    campaignId: 'wd-bengaluru',
    claim: { entityId, property, propertyLabel, statementId, valueRaw, valueText },
  };
}

export function bindingsToQuests(res: Response): Quest[] {
  const out: Quest[] = [];
  const seen = new Set<string>();
  for (const b of res.results?.bindings ?? []) {
    if (!b.item?.value || !b.itemLabel?.value || !b.statement?.value) continue;
    const q = toQuest(b);
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}

/** cite-claim's own bounded discovery set: a sibling to overpass.ts's buildCampaigns, kept out
 *  of the geographic sky's `campaigns` (App.tsx keeps this in `wdCampaigns`; the knowledge graph
 *  and find-quests' inSky gate read it, the geo sky never does). */
export function buildWikidataCampaigns(quests: Quest[]): Campaign[] {
  return [{ id: 'wd-bengaluru', name: 'Sources for Bengaluru, Wikidata', questIds: quests.slice(0, CAMPAIGN_SIZE).map((q) => q.id) }];
}

export async function loadWikidataQuests(): Promise<{ quests: Quest[]; source: 'live' | 'cached' | 'fallback' }> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { at: number; res: Response };
      if (Date.now() - c.at < TTL) return { quests: bindingsToQuests(c.res), source: 'cached' };
    }
  } catch { /* fall through */ }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, { headers: { accept: 'application/sparql-results+json' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    const res = (await r.json()) as Response;
    if (!res.results?.bindings?.length) throw new Error('empty');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), res })); } catch { /* ignore */ }
    return { quests: bindingsToQuests(res), source: 'live' };
  } catch {
    return { quests: bindingsToQuests(fallback as unknown as Response), source: 'fallback' };
  }
}
