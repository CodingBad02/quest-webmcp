/**
 * Survey: a partner site on its own origin. One import makes it agent-ready.
 * It receives a handoff from Quest, lets a person record what they saw at the entrance,
 * and registers check-contribution and submit-contribution for the agent.
 */
import { createQuestTools, createDialogConfirm, mountRack, result, safeText, type CheckResult } from '@gatherlight/quest-tools';
import { createStoreClient, type StoredContribution } from '../worker/src/client.ts';
import '@gatherlight/quest-tools/qt.css';
import './survey.css';

const STORE_URL = (import.meta.env.VITE_STORE_URL as string | undefined) ?? location.origin;
const QUEST_URL = (import.meta.env.VITE_QUEST_URL as string | undefined) ?? 'http://localhost:5173/';

const work = document.getElementById('work')!;
const strip = document.getElementById('handoff')!;
const stripText = document.getElementById('handoff-text')!;
const stripTime = document.getElementById('handoff-time')!;

type Draft = { wheelchair: '' | 'yes' | 'limited' | 'no'; imageDataUrl: string; note: string };
const draft: Draft = { wheelchair: '', imageDataUrl: '', note: '' };
let contribution: StoredContribution | null = null;
let store: ReturnType<typeof createStoreClient> | null = null;
let checked = false;
let submitted = false;

// ---------- validation and the confirm preview ----------

const WHEELCHAIR_LABEL: Record<Draft['wheelchair'], string> = { yes: 'Yes', limited: 'Limited', no: 'No', '': 'Not stated' };

function validate(): string[] {
  const errors: string[] = [];
  if (!draft.wheelchair) errors.push('wheelchair: choose yes, limited, or no.');
  if (!draft.imageDataUrl) errors.push('photo: add one photo of the entrance.');
  if (draft.note.length > 300) errors.push('note: keep it under 300 characters.');
  return errors;
}

function check(): CheckResult {
  if (!contribution) return result('invalid', 'No quest is open here. Open one from Quest first.');
  const errors = validate();
  checked = errors.length === 0;
  controller.refresh();
  renderErrors(errors);
  if (!checked) return result('invalid', `Not ready. Fix these:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
  const summary: [string, string][] = [['Wheelchair access', WHEELCHAIR_LABEL[draft.wheelchair]], ['Photo', 'Attached']];
  if (draft.note.trim()) summary.push(['Note', safeText(draft.note)]);
  return {
    ...result('checked', 'Ready. All checks passed. Ask the volunteer if they want to submit, then call submit-contribution.', { contributionId: contribution.id, questId: contribution.quest.id }),
    confirm: { summary, destination: "Quest's review queue", visibility: 'Held for review. Not public yet.', license: contribution.quest.license },
  };
}

async function submit() {
  if (!contribution || !store) return result('invalid', 'No quest is open here.');
  try {
    contribution = await store.upsert(contribution.id, { state: 'submitted', payload: { kind: 'access-photo', ...draft }, via: location.origin });
  } catch (e) {
    return result('invalid', `Not sent. ${(e as Error).message}`);
  }
  submitted = true;
  controller.refresh();
  renderDone();
  return result('submitted', `Submitted "${safeText(contribution.quest.title)}" for review. A reviewer on Quest checks it next.`, { contributionId: contribution.id, questId: contribution.quest.id });
}

// ---------- the five-verb grammar, two verbs implemented ----------

const controller = createQuestTools({
  protocol: 'quest/1',
  operations: { check, submit },
  available: () => {
    if (!contribution || submitted) return {};
    return { check: true, submit: checked ? true : { locked: 'Unlocks after check-contribution passes.' } };
  },
  confirm: createDialogConfirm(),
});
mountRack(document.getElementById('rack')!, controller, { emptyText: 'Tools appear when a quest arrives from Quest.' });

// ---------- UI ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderEmpty(message: string) {
  strip.hidden = true;
  work.replaceChildren(
    el('div', { class: 'survey-card' }),
  );
  const card = work.firstElementChild!;
  card.append(el('h2', { class: 'survey-card-title' }, 'Nothing to survey yet'), el('p', { class: 'survey-muted' }, message));
  const a = el('a', { class: 'survey-link', href: QUEST_URL }, 'Open Quest');
  card.append(a);
}

function renderErrors(errors: string[]) {
  const box = document.getElementById('errors');
  if (!box) return;
  box.replaceChildren(...errors.map((e) => el('li', {}, e)));
  box.hidden = errors.length === 0;
}

async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function renderForm(c: StoredContribution) {
  const card = el('div', { class: 'survey-card' });
  card.append(
    el('h2', { class: 'survey-card-title' }, safeText(c.quest.placeName, 80)),
    el('p', { class: 'survey-muted' }, 'Go to the entrance. Answer what you can see. The agent checks the form; you decide when it is sent.'),
  );

  const wc = el('label', { class: 'survey-field' }, 'Can a wheelchair user get in?');
  const select = el('select', { id: 'wheelchair' }) as HTMLSelectElement;
  for (const [v, label] of [['', 'Choose one'], ['yes', 'Yes, step-free'], ['limited', 'Limited, one step or help needed'], ['no', 'No']]) select.append(el('option', { value: v }, label));
  select.addEventListener('change', () => { draft.wheelchair = select.value as Draft['wheelchair']; edited(); });
  wc.append(select);

  const photo = el('label', { class: 'survey-field' }, 'Photo of the entrance');
  const file = el('input', { type: 'file', accept: 'image/*', capture: 'environment', id: 'photo' }) as HTMLInputElement;
  const preview = el('img', { class: 'survey-preview', alt: '', hidden: '' }) as HTMLImageElement;
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    draft.imageDataUrl = await downscale(f);
    preview.src = draft.imageDataUrl; preview.hidden = false;
    edited();
  });
  photo.append(file);

  const note = el('label', { class: 'survey-field' }, 'Notes for the reviewer');
  const ta = el('textarea', { id: 'note', rows: '3', maxlength: '300', placeholder: 'Anything else worth flagging' }) as HTMLTextAreaElement;
  ta.addEventListener('input', () => { draft.note = ta.value; edited(); });
  note.append(ta);

  const errors = el('ul', { id: 'errors', class: 'survey-errors', hidden: '' });
  const actions = el('div', { class: 'survey-actions' });
  const checkBtn = el('button', { class: 'qt-btn', type: 'button' }, 'Check');
  const sendBtn = el('button', { class: 'qt-btn qt-btn-primary', type: 'button' }, 'Send for review');
  checkBtn.addEventListener('click', () => controller.run('check', {}, { viaUi: true }));
  sendBtn.addEventListener('click', () => controller.run('submit', {}, { viaUi: true }));
  actions.append(checkBtn, sendBtn);

  card.append(wc, photo, preview, note, errors, el('div', { class: 'qt' }).appendChild(actions).parentElement!);
  work.replaceChildren(card);
}

function edited() {
  if (checked) { checked = false; controller.refresh(); }
}

function renderDone() {
  const card = el('div', { class: 'survey-card' });
  card.append(
    el('h2', { class: 'survey-card-title' }, 'Sent for review'),
    el('p', { class: 'survey-muted' }, `A reviewer on Quest reads it next. When they approve it, a star lights for ${safeText(contribution!.quest.placeName, 80)}.`),
    el('a', { class: 'survey-link', href: QUEST_URL }, 'Back to Quest'),
  );
  work.replaceChildren(card);
  strip.hidden = true;
}

function startCountdown(expiresAt: string) {
  const tick = () => {
    const ms = Date.parse(expiresAt) - Date.now();
    if (ms <= 0 || submitted) { strip.hidden = submitted; if (!submitted) { strip.dataset.expired = ''; stripText.textContent = 'Handoff expired. Ask your agent to reopen this quest from Quest.'; stripTime.textContent = ''; } return; }
    const s = Math.floor(ms / 1000);
    stripTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    setTimeout(tick, 1000);
  };
  tick();
}

// ---------- boot: exchange the handoff ----------

async function boot() {
  const token = new URLSearchParams(location.search).get('handoff');
  if (!token) return renderEmpty('This site receives quests from Quest. Ask your agent to find a step-free entry quest there.');
  try {
    const anon = createStoreClient(STORE_URL, 'exchange');
    const ex = await anon.exchange(token);
    contribution = ex.contribution;
    store = createStoreClient(STORE_URL, ex.session);
    if (contribution.quest.type !== 'access-photo') return renderEmpty('This site handles step-free entry surveys only.');
    if (contribution.state !== 'open') return renderEmpty(`This contribution is already ${contribution.state}.`);
    history.replaceState(null, '', location.pathname);
    strip.hidden = false;
    stripText.textContent = 'Carried from Quest · check-contribution ready · expires';
    startCountdown(ex.expiresAt);
    renderForm(contribution);
    controller.refresh();
  } catch (e) {
    renderEmpty((e as Error).message);
  }
}

boot();
