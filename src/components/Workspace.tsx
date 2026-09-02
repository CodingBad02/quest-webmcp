import { useEffect, useState } from 'react';
import { activeQuest, closeQuest, updateDraft, useAppState } from '../state/store';
import { controller } from '../webmcp/tools';
import { StateChip } from './StateChip';
import type { ContributionPayload, Quest } from '../types';

const PRESETS: [string, string][] = [['Weekdays 9 to 6', 'Mo-Fr 09:00-18:00'], ['Every day 9 to 9', 'Mo-Su 09:00-21:00'], ['Always open', '24/7'], ['Closed Sundays', 'Mo-Sa 09:00-18:00; Su off']];

function formatCountdown(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** DESIGN.md §7: Survey owns the form now. Quest just hands the volunteer a link and watches
 *  the handoff clock. `Reopen` mints a fresh one when it expires before the visit happens. */
function HandoffCard({ q }: { q: Quest }) {
  const handoff = useAppState((s) => (s.handoff?.questId === q.id ? s.handoff : null));
  const contribution = useAppState((s) => s.contributions.find((c) => c.questId === q.id));
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const expired = !handoff || now === null || Date.parse(handoff.expiresAt) <= now;
  const inFlight = Boolean(contribution && contribution.status !== 'open');

  return (
    <div className="handoff-card">
      {contribution && contribution.status !== 'open' && <StateChip state={contribution.status} pulse />}
      <p className="help">Your agent can take you there. The tools for this quest live on Survey.</p>
      {inFlight ? null : !expired && handoff && now !== null ? (
        <>
          <a className="btn primary" href={handoff.url}>Continue on Survey</a>
          <p className="handoff-countdown">Handoff expires <span className="mono">{formatCountdown(handoff.expiresAt, now)}</span></p>
        </>
      ) : (
        <button className="btn" type="button" onClick={() => { void controller.run('open', { id: q.id }, { viaUi: true }); }}>Reopen</button>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { 'verify-hours': 'Confirm hours', 'access-photo': 'Step-free entry', 'cite-claim': 'Cite a source' };

export function Workspace() {
  const q = useAppState(() => activeQuest());
  const draft = useAppState((s) => s.draft);
  const ws = useAppState((s) => s.workspace);
  const errors = useAppState((s) => s.checkErrors);
  const checkTitle = useAppState((s) => s.checkTitle);
  if (!q) return null;

  const head = (
    <div className="section-head">
      <h1>{q.placeName}</h1>
      <p className="muted">
        <span className={`kind kind-${q.type}`}>{KIND_LABEL[q.type]}</span>
        {q.address && <span>{q.address}</span>}
        {q.osmLink && <a href={q.osmLink} target="_blank" rel="noreferrer">View on OpenStreetMap</a>}
      </p>
    </div>
  );

  if (q.type === 'access-photo') {
    return (
      <div className="workspace" data-state={ws}>
        <button className="back" onClick={closeQuest}>← All quests</button>
        {head}
        <HandoffCard q={q} />
      </div>
    );
  }

  if (!draft) return null;
  const set = (p: ContributionPayload) => updateDraft(p);
  const locked = ws === 'submitted' || ws === 'approved';
  const lastStepLabel = q.type === 'cite-claim' ? 'Sourced' : 'Star';

  return (
    <div className="workspace" data-state={ws}>
      <button className="back" onClick={closeQuest}>← All quests</button>
      {head}

      <ol className="steps" aria-label="Progress">
        <Step n={1} label="Do the work" state={ws === 'in-workspace' ? 'on' : 'done'} />
        <Step n={2} label="Check" state={ws === 'checked' ? 'on' : ws === 'in-workspace' ? '' : 'done'} />
        <Step n={3} label="Review" state={ws === 'submitted' ? 'on' : ws === 'approved' ? 'done' : ''} />
        <Step n={4} label={lastStepLabel} state={ws === 'approved' ? 'on' : ''} />
      </ol>

      {draft.kind === 'verify-hours' && (
        <fieldset className="form" disabled={locked}>
          <p className="help">Call the place, check its website, or visit. Then enter the hours in OpenStreetMap form. Use HH:MM. Example: <code>Mo-Fr 08:00-17:00</code>. A comma splits a break. A semicolon splits day groups.</p>
          <div className="presets">{PRESETS.map(([l, v]) => <button type="button" key={v} className="chip" onClick={() => set({ ...draft, openingHours: v })}>{l}</button>)}</div>
          <div className="field"><label htmlFor="oh">Opening hours</label><input id="oh" value={draft.openingHours} placeholder="Mo-Sa 09:00-21:00" onChange={(e) => set({ ...draft, openingHours: e.target.value })} aria-describedby="err-0" /></div>
          <div className="field"><label htmlFor="vb">How did you check?</label>
            <select id="vb" value={draft.verifiedBy} onChange={(e) => set({ ...draft, verifiedBy: e.target.value as typeof draft.verifiedBy })}>
              <option value="">Choose</option><option value="phone">I called them</option><option value="website">Their website</option><option value="visit">I went there</option>
            </select></div>
          <div className="field"><label htmlFor="note">What did they say?</label><textarea id="note" rows={2} value={draft.note} placeholder="Spoke to the manager at 4 pm. Closed on the second Saturday." onChange={(e) => set({ ...draft, note: e.target.value })} /></div>
        </fieldset>
      )}

      {draft.kind === 'cite-claim' && q.claim && (
        <fieldset className="form" disabled={locked}>
          <p className="help">
            Claim: <strong>{q.placeName} · {q.claim.propertyLabel}: {q.claim.valueText}</strong>{' '}
            <a href={`https://www.wikidata.org/wiki/${q.claim.entityId}#${q.claim.property}`} target="_blank" rel="noreferrer">View on Wikidata</a>
          </p>
          <p className="help">Find a reliable, independent source that states this. Read it before you fill this in.</p>
          <div className="field">
            <label htmlFor="sourceUrl">Source URL</label>
            <input id="sourceUrl" type="url" value={draft.sourceUrl} placeholder="https://example.com/article" aria-describedby="err-0" onChange={(e) => set({ ...draft, sourceUrl: e.target.value })} />
            {checkTitle && <p className="muted small">Page title: {checkTitle}</p>}
          </div>
          <div className="field">
            <label htmlFor="quote">Where it says so</label>
            <textarea id="quote" rows={2} maxLength={300} value={draft.quote} placeholder="The sentence or figure on the page that states this." onChange={(e) => set({ ...draft, quote: e.target.value })} />
          </div>
          <div className="field">
            <label className="check-row" htmlFor="confirmed">
              <input id="confirmed" type="checkbox" checked={draft.confirmed} onChange={(e) => set({ ...draft, confirmed: e.target.checked })} />
              I read the source. It states this exact value.
            </label>
          </div>
        </fieldset>
      )}

      {errors.length > 0 && (
        <ul className="errors" id="err-0" role="alert">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}

      <div className="actions">
        {ws === 'in-workspace' && <button className="btn" onClick={() => { void controller.run('check', {}, { viaUi: true }); }}>Check</button>}
        {ws === 'checked' && (<>
          <StateChip state="checked" pulse />
          <button className="btn primary" onClick={() => { void controller.run('submit', {}, { viaUi: true }); }}>Send for review</button>
        </>)}
        {ws === 'submitted' && (<><StateChip state="submitted" pulse /><span className="muted">You will see it here when it is checked.</span></>)}
        {ws === 'approved' && <StateChip state="approved" pulse />}
      </div>
    </div>
  );
}

function Step({ n, label, state }: { n: number; label: string; state: '' | 'on' | 'done' }) {
  return (
    <li className={`step ${state}`} aria-current={state === 'on' ? 'step' : undefined}>
      <span className="step-dot" aria-hidden="true">
        {state === 'done' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : n}
      </span>
      <span className="step-label">{label}</span>
    </li>
  );
}
