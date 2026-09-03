import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { activeQuest, closeQuest, setState, updateDraft, useAppState } from '../state/store';
import { controller } from '../webmcp/tools';
import { KIND } from './QuestList';
import type { ContributionPayload, Quest } from '../types';

const PRESETS: [string, string][] = [['Weekdays 9 to 6', 'Mo-Fr 09:00-18:00'], ['Every day 9 to 9', 'Mo-Su 09:00-21:00'], ['Always open', '24/7'], ['Closed Sundays', 'Mo-Sa 09:00-18:00; Su off']];

function formatCountdown(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const label = 'text-sm font-medium text-muted-foreground';
const field = 'grid gap-1.5';
const select = 'min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-[15px] outline-none hover:border-[color-mix(in_srgb,var(--muted-foreground)_55%,var(--border))] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15';

/** Survey owns the access-photo form. Quest hands the volunteer a link and watches the clock. */
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
  const profile = useAppState((s) => s.profile);

  return (
    <div className="handoff-card grid max-w-[60ch] gap-4">
      <p className="text-[15px] leading-[1.55] text-muted-foreground">This quest continues on Survey. Your agent can take you there.</p>
      {!inFlight && (
        <div className={`${field} max-w-[320px]`}>
          <label className={label} htmlFor="name">Sign as</label>
          <Input id="name" value={profile.name} placeholder="Your first name" maxLength={30} onChange={(e) => setState({ profile: { ...profile, name: e.target.value } })} />
        </div>
      )}
      {inFlight ? (
        <p className="text-[15px]">{contribution?.status === 'approved' ? `Approved by ${contribution.reviewerName}.` : 'Sent. A reviewer reads it next.'}</p>
      ) : !expired && handoff && now !== null ? (
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild><a href={handoff.url}>Continue on Survey <ExternalLink aria-hidden="true" /></a></Button>
          <p className="handoff-countdown text-sm text-muted-foreground">Link expires <span className="font-mono font-medium tabular-nums text-foreground">{formatCountdown(handoff.expiresAt, now)}</span></p>
        </div>
      ) : (
        <Button variant="outline" className="justify-self-start" onClick={() => { void controller.run('open', { id: q.id }, { viaUi: true }); }}>Get a new link</Button>
      )}
    </div>
  );
}

export function Workspace() {
  const q = useAppState(() => activeQuest());
  const draft = useAppState((s) => s.draft);
  const ws = useAppState((s) => s.workspace);
  const errors = useAppState((s) => s.checkErrors);
  const checkTitle = useAppState((s) => s.checkTitle);
  const profile = useAppState((s) => s.profile);
  const contribution = useAppState((s) => s.contributions.find((c) => c.questId === s.activeQuestId && c.status !== 'rejected'));
  if (!q) return null;

  const head = (
    <div className="mb-6">
      <h1 className="font-display mb-2 text-[34px] leading-[1.1] font-medium tracking-[-.02em] text-balance">{q.placeName}</h1>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
        <Badge variant="kind">{KIND[q.type]}</Badge>
        {q.address && <span>{q.address}</span>}
        {q.osmLink && <a className="inline-flex items-center gap-1 text-foreground underline decoration-[color-mix(in_srgb,var(--muted-foreground)_55%,transparent)] hover:decoration-current" href={q.osmLink} target="_blank" rel="noreferrer">View on OpenStreetMap <ExternalLink className="size-3.5" aria-hidden="true" /></a>}
      </p>
    </div>
  );
  const back = <Button variant="link" className="back -ml-1 mb-3 h-9 px-1" onClick={closeQuest}><ArrowLeft aria-hidden="true" /> All quests</Button>;
  const shell = 'workspace rounded-xl border border-border bg-card p-7 shadow-(--shadow-card) max-sm:px-4 max-sm:py-5';

  if (q.type === 'access-photo') {
    return <div className={shell} data-state={ws}>{back}{head}<HandoffCard q={q} /></div>;
  }

  if (!draft) return null;
  const set = (p: ContributionPayload) => updateDraft(p);
  const locked = ws === 'submitted' || ws === 'approved';
  const lastStepLabel = q.type === 'cite-claim' ? 'Sourced' : 'Star';

  return (
    <div className={shell} data-state={ws}>
      {back}
      {head}

      <ol className="steps mb-7 flex items-center rounded-lg bg-secondary px-5 py-4 text-[13px] text-muted-foreground max-sm:px-3.5" aria-label="Progress">
        <Step n={1} label="Do" state={ws === 'in-workspace' ? 'on' : 'done'} />
        <Step n={2} label="Check" state={ws === 'checked' ? 'on' : ws === 'in-workspace' ? '' : 'done'} />
        <Step n={3} label="Review" state={ws === 'submitted' ? 'on' : ws === 'approved' ? 'done' : ''} />
        <Step n={4} label={lastStepLabel} state={ws === 'approved' ? 'on' : ''} />
      </ol>

      {draft.kind === 'verify-hours' && (
        <fieldset className="grid gap-4 border-0 p-0 disabled:opacity-70" disabled={locked}>
          <p className="max-w-[70ch] text-[15px] leading-[1.55] text-muted-foreground">Call the place, look at its website, or go there. Then enter the hours in OpenStreetMap form. Example: <code className="font-mono text-[.92em]">Mo-Fr 08:00-17:00</code>.</p>
          <div className="flex flex-wrap gap-2">{PRESETS.map(([l, v]) => <Button type="button" key={v} variant="outline" size="sm" onClick={() => set({ ...draft, openingHours: v })}>{l}</Button>)}</div>
          <div className={field}><label className={label} htmlFor="oh">Opening hours</label><Input id="oh" value={draft.openingHours} placeholder="Mo-Sa 09:00-21:00" onChange={(e) => set({ ...draft, openingHours: e.target.value })} aria-describedby="err-0" /></div>
          <div className={field}><label className={label} htmlFor="vb">How did you check?</label>
            <select id="vb" className={select} value={draft.verifiedBy} onChange={(e) => set({ ...draft, verifiedBy: e.target.value as typeof draft.verifiedBy })}>
              <option value="">Choose</option><option value="phone">I called them</option><option value="website">Their website</option><option value="visit">I went there</option>
            </select></div>
          <div className={field}><label className={label} htmlFor="note">What did they say?</label><Textarea id="note" rows={2} value={draft.note} placeholder="Spoke to the manager at 4 pm. Closed on the second Saturday." onChange={(e) => set({ ...draft, note: e.target.value })} /></div>
        </fieldset>
      )}

      {draft.kind === 'cite-claim' && q.claim && (
        <fieldset className="grid gap-4 border-0 p-0 disabled:opacity-70" disabled={locked}>
          <p className="text-[15px] leading-[1.55] text-muted-foreground">
            Claim: <strong className="text-foreground">{q.placeName} · {q.claim.propertyLabel}: {q.claim.valueText}</strong>{' '}
            <a className="text-foreground underline" href={`https://www.wikidata.org/wiki/${q.claim.entityId}#${q.claim.property}`} target="_blank" rel="noreferrer">View on Wikidata</a>
          </p>
          <p className="max-w-[70ch] text-[15px] leading-[1.55] text-muted-foreground">Find a reliable, independent source that states this. Read it before you fill this in.</p>
          <div className={field}>
            <label className={label} htmlFor="sourceUrl">Source URL</label>
            <Input id="sourceUrl" type="url" value={draft.sourceUrl} placeholder="https://example.com/article" aria-describedby="err-0" onChange={(e) => set({ ...draft, sourceUrl: e.target.value })} />
            {checkTitle && <p className="text-sm text-muted-foreground">Page title: {checkTitle}</p>}
          </div>
          <div className={field}>
            <label className={label} htmlFor="quote">Where it says so</label>
            <Textarea id="quote" rows={2} maxLength={300} value={draft.quote} placeholder="The sentence or figure on the page that states this." onChange={(e) => set({ ...draft, quote: e.target.value })} />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[15px]" htmlFor="confirmed">
            <input id="confirmed" type="checkbox" className="size-4 accent-primary" checked={draft.confirmed} onChange={(e) => set({ ...draft, confirmed: e.target.checked })} />
            I read the source. It states this exact value.
          </label>
        </fieldset>
      )}

      {ws === 'in-workspace' && (
        <div className={`${field} mt-5 max-w-[320px]`}>
          <label className={label} htmlFor="name">Sign as</label>
          <Input id="name" value={profile.name} placeholder="Your first name" maxLength={30} onChange={(e) => setState({ profile: { ...profile, name: e.target.value } })} />
        </div>
      )}

      {errors.length > 0 && (
        <ul className="errors mt-5 grid gap-1 rounded-md border border-destructive/50 bg-[color-mix(in_srgb,var(--destructive)_7%,var(--card))] px-4 py-3 pl-8 text-sm leading-[1.5] text-destructive [list-style:disc]" id="err-0" role="alert">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}

      <div className="actions mt-6 flex flex-wrap items-center gap-3">
        {ws === 'in-workspace' && <Button variant="outline" onClick={() => { void controller.run('check', {}, { viaUi: true }); }}>Check</Button>}
        {ws === 'checked' && (<>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Check className="size-4" aria-hidden="true" /> Ready</span>
          <Button onClick={() => { void controller.run('submit', {}, { viaUi: true }); }}>Send for review</Button>
        </>)}
        {ws === 'submitted' && <p className="text-[15px] text-muted-foreground">Sent. A reviewer reads it next. You can leave this page.</p>}
        {ws === 'approved' && (<>
          <p className="text-[15px]">Approved{contribution?.reviewerName ? ` by ${contribution.reviewerName}` : ''}.</p>
          <Button variant="gold" onClick={() => {
            if (q.type === 'cite-claim') { setState({ openSources: true }); closeQuest(); requestAnimationFrame(() => document.getElementById('sources')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); return; }
            setState({ spotlightQuestId: q.id }); closeQuest(); window.scrollTo({ top: 0, behavior: 'smooth' });
          }}>{q.type === 'cite-claim' ? 'See your source' : 'See your star'}</Button>
        </>)}
      </div>
    </div>
  );
}

function Step({ n, label, state }: { n: number; label: string; state: '' | 'on' | 'done' }) {
  return (
    <li className={`step ${state}`} aria-current={state === 'on' ? 'step' : undefined}>
      <span className="step-dot" aria-hidden="true">
        {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : n}
      </span>
      <span className="step-label">{label}</span>
    </li>
  );
}
