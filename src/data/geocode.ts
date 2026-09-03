/**
 * Nominatim geocoding: typed place first, browser geolocation second (ProfileBar, find-quests'
 * `near`). One request per second across both calls (Nominatim usage policy), 8s timeout, and a
 * User-Agent header per policy — browsers may drop that header on a cross-origin request, but the
 * intent stays on record. Errors return null; callers show their own actionable message.
 */
import { safeText } from '@gatherlight/quest-tools';
import type { Place } from '../types';

const ENDPOINT = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'User-Agent': 'Quest/0.1 (github.com/CodingBad02/quest-webmcp)' };
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 8000;

let lastRequestAt = 0;
async function gate() {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

interface NominatimAddress { suburb?: string; city?: string; town?: string; state?: string }
interface NominatimPlace { display_name: string; lat: string; lon: string; address?: NominatimAddress }

/** "suburb, city" when both exist, else the first two comma parts of `display_name`. */
function labelFrom(displayName: string, address?: NominatimAddress): string {
  const city = address?.city ?? address?.town;
  if (address?.suburb && city) return safeText(`${address.suburb}, ${city}`, 60);
  const parts = displayName.split(',').map((s) => s.trim()).filter(Boolean);
  return safeText(parts.slice(0, 2).join(', '), 60);
}

async function fetchJson(url: string): Promise<unknown | null> {
  await gate();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function toPlace(hit: NominatimPlace | null | undefined): Place | null {
  if (!hit) return null;
  const lat = Number(hit.lat), lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { label: labelFrom(hit.display_name, hit.address), lat, lon };
}

export async function geocode(query: string): Promise<Place | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `${ENDPOINT}/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&addressdetails=1`;
  const data = (await fetchJson(url)) as NominatimPlace[] | null;
  return toPlace(data?.[0]);
}

export async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  const url = `${ENDPOINT}/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=14`;
  const data = (await fetchJson(url)) as NominatimPlace | null;
  if (!data) return null;
  return toPlace({ ...data, lat: String(lat), lon: String(lon) });
}

// ---------- Photon: search-as-you-type suggestions (Nominatim's policy forbids autocomplete) ----------

const PHOTON = 'https://photon.komoot.io/api/';

interface PhotonFeature { geometry: { coordinates: [number, number] }; properties: { name?: string; city?: string; town?: string; village?: string; state?: string; country?: string; osm_key?: string } }

function photonLabel(p: PhotonFeature['properties']): string {
  const city = p.city ?? p.town ?? p.village;
  const parts = [p.name, city && city !== p.name ? city : undefined, !city ? p.state : undefined].filter(Boolean);
  return safeText(parts.join(', '), 60);
}

/** Up to `limit` places matching a partial query, biased toward `near`. Aborts on the caller's signal. */
export async function suggest(query: string, near: Place, signal?: AbortSignal, limit = 5): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=${limit}&lang=en&lat=${near.lat}&lon=${near.lon}`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const data = (await r.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    return (data.features ?? []).flatMap((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const label = photonLabel(f.properties);
      if (!label || seen.has(label) || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      seen.add(label);
      return [{ label, lat, lon }];
    });
  } catch {
    return [];
  }
}
