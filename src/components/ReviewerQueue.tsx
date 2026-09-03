import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setState, useAppState } from '../state/store';
import { controller, rejectImpl } from '../webmcp/tools';
import { store, SURVEY_URL } from '../state/storeClient';
import { StateChip } from './StateChip';
import type { Contribution } from '../types';

const CHECKS: Record<string, string[]> = {
  'verify-hours': ['Hours parse as valid syntax', 'Method of checking is plausible', 'Note is specific', 'No personal data', 'Plausible for this kind of place'],
  'access-photo': ['Photo shows the entrance', 'No faces or number plates', 'Access value matches the photo', 'Note explains "limited"', 'Location fits the quest'],
  'cite-claim': ['Source is independent of Wikimedia', 'Source states this exact value', 'Source is reliable for this kind of fact', 'No personal data'],
};

/** Open the approved edit in iD on the Survey origin. A stage handoff: single use, 15 minutes, no upload. */
async function stageInId(c: Contribution) {
  const { handoff } = await store.issueHandoff(c.id, new URL(SURVEY_URL).origin, 900, 'stage');
  window.open(`${SURVEY_URL}id.html?handoff=${handoff}`, '_blank', 'noopener');
}

const dl = 'grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[15px] max-sm:grid-cols-1 [&_dt]:text-muted-foreground [&_dd]:m-0 [&_code]:font-mono [&_code]:text-[.92em]';

function Item({ c }: { c: Contribution }) {
  const [comment, setComment] = useState('');
  const [needReason, setNeedReason] = useState(false);
  const p = c.payload;
  return (
    <li className="review rounded-lg border border-border bg-secondary p-5">
      <div className="review-head mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <strong className="text-[17px] tracking-[-.012em]">{c.questTitle}</strong>
        <span className="text-sm text-muted-foreground">by {c.volunteerName} · id <code className="font-mono text-[.92em]">{c.id}</code></span>
      </div>
      <div className="review-body grid gap-3">
        {p.kind === 'verify-hours' && <dl className={dl}><dt>Opening hours</dt><dd><code>{p.openingHours}</code></dd><dt>Checked by</dt><dd>{p.verifiedBy}</dd><dt>Note</dt><dd>{p.note}</dd></dl>}
        {p.kind === 'access-photo' && <><img className="preview max-h-60 max-w-80 rounded-md border border-border" src={p.imageDataUrl} alt="Entrance submitted by volunteer" /><dl className={dl}><dt>Wheelchair</dt><dd><code>wheelchair={p.wheelchair}</code></dd>{p.note && <><dt>Note</dt><dd>{p.note}</dd></>}</dl></>}
        {p.kind === 'cite-claim' && (
          <dl className={dl}>
            <dt>Claim</dt><dd>{c.questTitle}</dd>
            <dt>Source</dt><dd><a className="underline break-all" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.sourceUrl}</a></dd>
            <dt>Where it says so</dt><dd>{p.quote}</dd>
          </dl>
        )}
      </div>
      <ul className="checklist my-4 grid gap-1.5 text-sm">{CHECKS[p.kind].map((t) => <li key={t}><label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-primary" /> {t}</label></li>)}</ul>
      <div className="actions flex flex-wrap items-center gap-2.5">
        <Input className="min-w-[180px] flex-1" value={comment} placeholder="Optional note to the volunteer" aria-invalid={needReason || undefined} onChange={(e) => { setComment(e.target.value); setNeedReason(false); }} />
        <Button variant="outline" onClick={() => { if (!comment.trim()) { setNeedReason(true); return; } void rejectImpl(c.id, comment.trim()); }}>Send back</Button>
        <Button onClick={() => { void controller.run('approve', { contributionId: c.id, comment: comment.trim() || undefined }, { viaUi: true }); }}>Approve</Button>
        {needReason && <p className="w-full text-sm text-destructive" role="alert">Say what to fix.</p>}
      </div>
    </li>
  );
}

export function ReviewerQueue() {
  const contributions = useAppState((s) => s.contributions);
  const profile = useAppState((s) => s.profile);
  const pending = contributions.filter((c) => c.status === 'submitted');
  const done = contributions.filter((c) => ['approved', 'rejected', 'stale', 'landed'].includes(c.status));

  return (
    <div className="queue rounded-xl border border-border bg-card p-7 shadow-(--shadow-card) max-sm:px-4 max-sm:py-5">
      <div className="mb-6">
        <h1 className="font-display mb-2 text-[34px] leading-[1.1] font-medium tracking-[-.02em]">Review</h1>
        <p className="max-w-[68ch] text-[15px] text-muted-foreground">Read each one. Approve it, or send it back with one clear reason.</p>
      </div>
      <div className="mb-5 flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="rname">Your first name</label>
        <Input id="rname" className="max-w-[240px]" value={profile.name} placeholder="Tom" maxLength={30} onChange={(e) => setState({ profile: { ...profile, name: e.target.value } })} />
      </div>
      {pending.length === 0
        ? <div className="empty rounded-xl border border-dashed border-border px-7 py-10 text-center text-muted-foreground">Nothing to review. New submissions appear here as they arrive.</div>
        : <ul className="reviews grid gap-4">{pending.map((c) => <Item key={c.id} c={c} />)}</ul>}
      {done.length > 0 && (
        <div className="mine mt-10">
          <h2 className="font-display mb-3 text-[23px] leading-[1.2] font-medium tracking-[-.015em]">Reviewed</h2>
          <ul className="grid gap-2">{done.map((c) => (
            <li key={c.id} className="mine-item flex flex-wrap items-center gap-2.5 text-sm">
              <StateChip state={c.status} /> {c.questTitle} · {c.volunteerName}
              {c.via && c.via !== location.origin && <Badge variant="mono">via Survey</Badge>}
              {c.status === 'approved' && c.payload.kind !== 'cite-claim' && <Button variant="outline" size="xs" className="ml-auto" type="button" onClick={() => { void stageInId(c); }}>Stage in iD</Button>}
            </li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
