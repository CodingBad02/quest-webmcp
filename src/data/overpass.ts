import { isDefaultPlace, type Campaign, type Place, type Quest, type QuestType } from '../types';
import fallback from './fallbackOverpass.json';

// Public Overpass instances, tried in order. The main one returns 504 under load.
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const CACHE_PREFIX = 'quest.overpass.v1';
const TTL = 24 * 3600 * 1000;
const AMENITIES = '^(pharmacy|clinic|library|community_centre|cafe|toilets|bank|post_office)$';

/** Cache key includes the place rounded to 3 decimals, so each place keeps its own 24h cache. */
function cacheKey(place: Place) { return `${CACHE_PREFIX}:${place.lat.toFixed(3)},${place.lon.toFixed(3)}`; }

export function clearOverpassCache(place: Place) { try { localStorage.removeItem(cacheKey(place)); } catch { /* ignore */ } }

interface Element { type: 'node' | 'way' | 'relation'; id: number; version?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> }
interface Response { elements: Element[] }

// `meta` adds each element's version, the conflict marker captured when a quest is opened.
const query = (lat: number, lon: number) => `[out:json][timeout:25];
nwr(around:1000,${lat},${lon})["amenity"~"${AMENITIES}"]["name"];
out meta center;`;

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
    osmRef: `${el.type}/${el.id}`,
    osmVersion: el.version,
    sourceTags: el.tags,
    estimatedMinutes: isHours ? (HOURS_MIN[amenity] ?? 5) : 10,
    requiredSkills: isHours ? ['phone'] : ['photo', 'visit'],
    languages: ['English', 'Kannada', 'Hindi'],
    remote: isHours,
    campaignId: isHours ? 'hours' : 'access',
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

/** A panel holds n stars. Places someone already worked on keep their star; open places fill the rest,
 *  so the sky shows history and `find-quests` never runs dry while gaps remain. */
export function buildCampaigns(quests: Quest[], place: Place, contributedQuestIds: ReadonlySet<string> = new Set()): Campaign[] {
  const pick = (id: string, name: string, n: number) => {
    const pool = quests.filter((q) => q.campaignId === id);
    const worked = pool.filter((q) => contributedQuestIds.has(q.id));
    const open = pool.filter((q) => !contributedQuestIds.has(q.id));
    return { id, name, questIds: [...worked, ...open].slice(0, Math.max(n, worked.length)).map((q) => q.id) };
  };
  return [
    pick('access', `Step-free entrances, ${place.label}`, 12),
    pick('hours', `Opening hours, ${place.label}`, 10),
  ];
}

/** The bundled fallback JSON is only honest for the default place; anywhere else, a failed live
 *  query yields an empty list and App.tsx's source pill names the unreachable place. */
export async function loadQuests(place: Place): Promise<{ quests: Quest[]; source: 'live' | 'cached' | 'fallback' }> {
  const key = cacheKey(place);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw) as { at: number; res: Response };
      if (Date.now() - c.at < TTL) return { quests: elementsToQuests(c.res), source: 'cached' };
    }
  } catch { /* fall through */ }
  try {
    let r: globalThis.Response | null = null;
    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12_000);
      try {
        const attempt = await fetch(endpoint, { method: 'POST', body: 'data=' + encodeURIComponent(query(place.lat, place.lon)), signal: ctrl.signal });
        if (attempt.ok) { r = attempt; break; }
      } catch { /* try the next instance */ } finally { clearTimeout(t); }
    }
    if (!r) throw new Error('Overpass unreachable');
    const res = (await r.json()) as Response;
    if (!res.elements?.length) throw new Error('empty');
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), res })); } catch { /* ignore */ }
    return { quests: elementsToQuests(res), source: 'live' };
  } catch {
    if (isDefaultPlace(place)) return { quests: elementsToQuests(fallback as unknown as Response), source: 'fallback' };
    return { quests: [], source: 'fallback' };
  }
}
