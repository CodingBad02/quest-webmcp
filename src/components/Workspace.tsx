import { useRef } from 'react';
import { activeQuest, closeQuest, updateDraft, useAppState } from '../state/store';
import { checkImpl, submitImpl } from '../webmcp/tools';
import { StateChip } from './StateChip';
import type { ContributionPayload } from '../types';

async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

const PRESETS: [string, string][] = [['Weekdays 9 to 6', 'Mo-Fr 09:00-18:00'], ['Every day 9 to 9', 'Mo-Su 09:00-21:00'], ['Always open', '24/7'], ['Closed Sundays', 'Mo-Sa 09:00-18:00; Su off']];

export function Workspace() {
  const q = useAppState(() => activeQuest());
  const draft = useAppState((s) => s.draft);
  const ws = useAppState((s) => s.workspace);
  const errors = useAppState((s) => s.checkErrors);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!q || !draft) return null;

  const set = (p: ContributionPayload) => updateDraft(p);
  const locked = ws === 'submitted' || ws === 'approved';

  return (
    <div className="workspace" data-state={ws}>
      <button className="back" onClick={closeQuest}>← All quests</button>
      <div className="section-head">
        <h1>{q.placeName}</h1>
        <p className="muted">
          <span className={`kind kind-${q.type}`}>{q.type === 'verify-hours' ? 'Confirm hours' : 'Step-free entry'}</span>
          {q.address && <span>{q.address}</span>}
          {q.osmLink && <a href={q.osmLink} target="_blank" rel="noreferrer">View on OpenStreetMap</a>}
        </p>
      </div>

      <ol className="steps" aria-label="Progress">
        <Step n={1} label="Do the work" state={ws === 'in-workspace' ? 'on' : 'done'} />
        <Step n={2} label="Check" state={ws === 'checked' ? 'on' : ws === 'in-workspace' ? '' : 'done'} />
        <Step n={3} label="Review" state={ws === 'submitted' ? 'on' : ws === 'approved' ? 'done' : ''} />
        <Step n={4} label="Star" state={ws === 'approved' ? 'on' : ''} />
      </ol>

      <fieldset className="form" disabled={locked}>
        {draft.kind === 'verify-hours' && (
          <>
            <p className="help">Call the place, check its website, or visit. Then enter the hours in OpenStreetMap form. Use HH:MM. Example: <code>Mo-Fr 08:00-17:00</code>. A comma splits a break. A semicolon splits day groups.</p>
            <div className="presets">{PRESETS.map(([l, v]) => <button type="button" key={v} className="chip" onClick={() => set({ ...draft, openingHours: v })}>{l}</button>)}</div>
            <div className="field"><label htmlFor="oh">Opening hours</label><input id="oh" value={draft.openingHours} placeholder="Mo-Sa 09:00-21:00" onChange={(e) => set({ ...draft, openingHours: e.target.value })} aria-describedby="err-0" /></div>
            <div className="field"><label htmlFor="vb">How did you check?</label>
              <select id="vb" value={draft.verifiedBy} onChange={(e) => set({ ...draft, verifiedBy: e.target.value as typeof draft.verifiedBy })}>
                <option value="">Choose</option><option value="phone">I called them</option><option value="website">Their website</option><option value="visit">I went there</option>
              </select></div>
            <div className="field"><label htmlFor="note">What did they say?</label><textarea id="note" rows={2} value={draft.note} placeholder="Spoke to the manager at 4 pm. Closed on the second Saturday." onChange={(e) => set({ ...draft, note: e.target.value })} /></div>
          </>
        )}
        {draft.kind === 'access-photo' && (
          <>
            <p className="help">Photograph the main entrance from the street. No faces or number plates. Step-free means no steps, no high kerb, and a door a wheelchair fits through. Not sure? Pick “limited” and say why.</p>
            <div className="field">
              <label htmlFor="photo">Entrance photo</label>
              <input id="photo" ref={fileRef} type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ ...draft, imageDataUrl: await resizeImage(f) }); }} />
              {draft.imageDataUrl && <img className="preview" src={draft.imageDataUrl} alt="Entrance preview" />}
            </div>
            <fieldset className="field radios"><legend>Can a wheelchair user get in?</legend>
              {(['yes', 'limited', 'no'] as const).map((v) => (
                <label key={v} className={`chip ${draft.wheelchair === v ? 'on' : ''}`}><input type="radio" name="wc" checked={draft.wheelchair === v} onChange={() => set({ ...draft, wheelchair: v })} /> {v}</label>
              ))}
            </fieldset>
            <div className="field"><label htmlFor="note2">Notes {draft.wheelchair === 'limited' && '(required for limited)'}</label><textarea id="note2" rows={2} value={draft.note} placeholder="One 8 cm step at the door. Staff bring a ramp if asked." onChange={(e) => set({ ...draft, note: e.target.value })} /></div>
          </>
        )}
      </fieldset>

      {errors.length > 0 && (
        <ul className="errors" id="err-0" role="alert">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}

      <div className="actions">
        {ws === 'in-workspace' && <button className="btn" onClick={() => checkImpl()}>Check</button>}
        {ws === 'checked' && (<>
          <StateChip state="checked" pulse />
          <button className="btn primary" onClick={() => submitImpl({ viaUi: true })}>Send for review</button>
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
