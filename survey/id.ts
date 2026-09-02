/**
 * Stage an approved contribution in iD, the OpenStreetMap editor, without uploading.
 * The reviewer arrives with a `stage` handoff. We load the live element, compare its version
 * with the one captured when the quest was opened, and, if unchanged, put the exact tag diff
 * into iD's undoable history. P0 stops here: the reviewer sees the unsaved diff. No upload.
 */
import { createStoreClient, type StoredContribution } from '../worker/src/client.ts';
import '@gatherlight/quest-tools/qt.css';
import './survey.css';

const ID_VERSION = '2.42.2';
const ID_ASSETS = `https://cdn.jsdelivr.net/npm/@openstreetmap/id@${ID_VERSION}/dist/`;
const STORE_URL = (import.meta.env.VITE_STORE_URL as string | undefined) || location.origin;

// The iD bundle is a UMD global. We use five calls from it.
interface IdEntity { id: string; version?: string; tags: Record<string, string> }
interface IdContext {
  assetPath(p: string): IdContext;
  containerNode(el: HTMLElement): IdContext;
  embed(v: boolean): IdContext;
  init(): IdContext;
  loadEntity(id: string, cb: (err: unknown) => void): void;
  hasEntity(id: string): IdEntity | undefined;
  perform(action: unknown, annotation: string): void;
  zoomToEntity(id: string): void;
}
declare const iD: {
  coreContext(): IdContext;
  actionChangeTags(id: string, tags: Record<string, string>): unknown;
};

const status = document.getElementById('status')!;
const strip = document.getElementById('handoff')!;
const stripText = document.getElementById('handoff-text')!;
const stripTime = document.getElementById('handoff-time')!;

function say(text: string, tone: 'info' | 'warn' | 'ok' = 'info') {
  status.textContent = text;
  status.dataset.tone = tone;
}

/** OSM tags this contribution proposes. Standard keys only: the value, its check_date, its source. */
function proposedTags(c: StoredContribution): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const p = c.payload as Record<string, string>;
  if (c.quest.type === 'verify-hours' && p.openingHours) {
    return { opening_hours: p.openingHours, 'check_date:opening_hours': today, 'source:opening_hours': p.verifiedBy === 'website' ? 'website' : 'survey' };
  }
  if (c.quest.type === 'access-photo' && p.wheelchair) {
    return { wheelchair: p.wheelchair, 'check_date:wheelchair': today, 'source:wheelchair': 'survey' };
  }
  return {};
}

/** `node/123` → `n123`, the id form iD uses. */
function idFor(osmRef: string): string | null {
  const m = osmRef.match(/^(node|way|relation)\/(\d+)$/);
  return m ? `${m[1][0]}${m[2]}` : null;
}

function countdown(expiresAt: string) {
  const tick = () => {
    const ms = Date.parse(expiresAt) - Date.now();
    if (ms <= 0) { stripTime.textContent = ''; stripText.textContent = 'Handoff expired. The staged edit stays until you close this tab.'; return; }
    const s = Math.floor(ms / 1000);
    stripTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    setTimeout(tick, 1000);
  };
  tick();
}

async function boot() {
  const token = new URLSearchParams(location.search).get('handoff');
  if (!token) return say('Open an approved contribution from Quest\'s review queue and choose Stage in iD.');
  let c: StoredContribution;
  try {
    const ex = await createStoreClient(STORE_URL, 'exchange').exchange(token);
    if (ex.action !== 'stage') return say('This handoff is not for staging.', 'warn');
    c = ex.contribution as StoredContribution;
    history.replaceState(null, '', location.pathname);
    strip.hidden = false;
    stripText.textContent = `Carried from Quest · ${c.quest.placeName} · approved by ${c.reviewerName ?? 'a reviewer'} · expires`;
    countdown(ex.expiresAt);
  } catch (e) {
    return say((e as Error).message, 'warn');
  }

  const eid = c.quest.osmRef ? idFor(c.quest.osmRef) : null;
  const tags = proposedTags(c);
  if (!eid) return say('This contribution has no OpenStreetMap element reference.', 'warn');
  if (!Object.keys(tags).length) return say('This contribution proposes no tag change.', 'warn');

  say('Loading the live element from OpenStreetMap…');
  // iD's first-run splash blocks the map. The reviewer came here to see one diff, not to be welcomed.
  try {
    localStorage.setItem('sawSplash', 'true');
    localStorage.setItem('sawPrivacyVersion', '20201202');
    // Each staging is a fresh, single diff. Drop iD's saved history so it does not offer to restore an old one.
    for (const k of Object.keys(localStorage)) if (k.includes('saved_history')) localStorage.removeItem(k);
  } catch { /* fine */ }
  const context = iD.coreContext().assetPath(ID_ASSETS).containerNode(document.getElementById('id-container')!).embed(true).init();

  // iD calls back once for the entity and once for its parent relations, in either order. Stage once, when the entity is there.
  let staged = false;
  let callbacks = 0;
  context.loadEntity(eid, (err) => {
    if (staged) return;
    if (err) return say(`Could not load ${c.quest.osmRef} from OpenStreetMap. ${String(err)}`, 'warn');
    const entity = context.hasEntity(eid);
    callbacks++;
    if (!entity) { if (callbacks >= 2) say(`${c.quest.osmRef} is not in the editor yet. Zoom in and try again.`, 'warn'); return; }
    staged = true;
    const live = entity.version ? Number(entity.version) : undefined;
    if (c.quest.osmVersion !== undefined && live !== undefined && live !== c.quest.osmVersion) {
      context.zoomToEntity(eid);
      return say(`${c.quest.placeName} changed on OpenStreetMap since this quest was opened (version ${c.quest.osmVersion} → ${live}). Nothing staged. Mark it stale in Quest.`, 'warn');
    }
    const merged = { ...entity.tags, ...tags };
    try {
      context.perform(iD.actionChangeTags(eid, merged), `Quest: ${c.quest.title}`);
      // zoomToEntity selects the entity once the map has drawn it. Entering select mode by hand races the UI.
      context.zoomToEntity(eid);
    } catch (e) {
      return say(`Could not stage the change in the editor. ${String(e)}`, 'warn');
    }
    const diff = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(' · ');
    say(`Staged, not uploaded: ${diff}. Review the change in the editor. Uploading needs your OpenStreetMap account and is not part of this step.`, 'ok');
  });
}

boot();
