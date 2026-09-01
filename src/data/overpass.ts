import type { Campaign, Quest, QuestType } from '../types';
import fallback from './fallbackOverpass.json';
import { REWRITE_CAMPAIGN, rewriteSeeds } from './seedQuests';

const CENTER = { lat: 12.9716, lon: 77.5946 };
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const CACHE_KEY = 'quest.overpass.v1';
const TTL = 24 * 3600 * 1000;
const AMENITIES = '^(pharmacy|clinic|library|community_centre|cafe|toilets|bank|post_office)$';

interface Element { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> }
interface Response { elements: Element[] }

const query = (lat: number, lon: number) => `[out:json][timeout:25];
nwr(around:1000,${lat},${lon})["amenity"~"${AMENITIES}"]["name"];
out center tags;`;

const HOURS_MIN: Record<string, number> = { cafe: 5, pharmacy: 5, bank: 5, post_office: 5, library: 5, clinic: 5, community_centre: 8, toilets: 10 };

/** OSM tag values are public free text. Strip control characters and cap length. */
function clean(s: string) { return s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 80); }

function address(t: Record<string, string>) {
  const parts = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] ?? t['addr:city']].filter(Boolean).map(clean);
  return parts.length ? parts.join(', ') : undefined;
}

function toQuest(el: Element, type: QuestType): Quest {
  const p = el.type === 'node' ? { lat: el.lat!, lon: el.lon! } : el.center!;
  const name = clean(el.tags.name);
  const amenity = el.tags.amenity;
  const isHours = type === 'verify-hours';
  return {
    id: `${isHours ? 'vh' : 'ap'}_${el.type}_${el.id}`,
    type,
    title: isHours ? `Confirm opening hours: ${name}` : `Check step-free entry: ${name}`,
    placeName: name,
    amenity,
    address: address(el.tags),
    lat: p.lat, lon: p.lon,
    osmLink: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    sourceTags: el.tags,
    estimatedMinutes: isHours ? (HOURS_MIN[amenity] ?? 5) : 10,
    requiredSkills: isHours ? ['phone'] : ['photo', 'visit'],
    languages: ['English', 'Kannada', 'Hindi'],
    remote: isHours,
    campaignId: isHours ? 'hours-central-blr' : 'access-central-blr',
  };
}

export function elementsToQuests(res: Response): Quest[] {
  const out: Quest[] = [];
  for (const el of res.elements) {
    if (!el.tags?.name || !el.tags.amenity) continue;
    if (!el.tags.opening_hours) out.push(toQuest(el, 'verify-hours'));
    if (!el.tags.wheelchair) out.push(toQuest(el, 'access-photo'));
  }
  return out;
}

export function buildCampaigns(quests: Quest[]): Campaign[] {
  const pick = (id: string, name: string, n: number) => ({ id, name, questIds: quests.filter((q) => q.campaignId === id).slice(0, n).map((q) => q.id) });
  return [
    pick('access-central-blr', 'Step-free entrances, central Bengaluru', 12),
    pick('hours-central-blr', 'Opening hours, central Bengaluru', 10),
    { id: REWRITE_CAMPAIGN, name: 'Plain words for public help pages', questIds: rewriteSeeds.map((q) => q.id) },
  ];
}

export async function loadQuests(): Promise<{ quests: Quest[]; source: 'live' | 'cached' | 'fallback' }> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { at: number; res: Response };
      if (Date.now() - c.at < TTL) return { quests: [...elementsToQuests(c.res), ...rewriteSeeds], source: 'cached' };
    }
  } catch { /* fall through */ }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(ENDPOINT, { method: 'POST', body: 'data=' + encodeURIComponent(query(CENTER.lat, CENTER.lon)), signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    const res = (await r.json()) as Response;
    if (!res.elements?.length) throw new Error('empty');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), res })); } catch { /* ignore */ }
    return { quests: [...elementsToQuests(res), ...rewriteSeeds], source: 'live' };
  } catch {
    return { quests: [...elementsToQuests(fallback as unknown as Response), ...rewriteSeeds], source: 'fallback' };
  }
}
