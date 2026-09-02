import { useState } from 'react';
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

function Item({ c }: { c: Contribution }) {
  const [comment, setComment] = useState('');
  const p = c.payload;
  return (
    <li className="review">
      <div className="review-head">
        <strong>{c.questTitle}</strong>
        <span className="muted">by {c.volunteerName} · id <code>{c.id}</code></span>
      </div>
      <div className="review-body">
        {p.kind === 'verify-hours' && <dl><dt>Opening hours</dt><dd><code>{p.openingHours}</code></dd><dt>Checked by</dt><dd>{p.verifiedBy}</dd><dt>Note</dt><dd>{p.note}</dd></dl>}
        {p.kind === 'access-photo' && <><img className="preview" src={p.imageDataUrl} alt="Entrance submitted by volunteer" /><dl><dt>Wheelchair</dt><dd><code>wheelchair={p.wheelchair}</code></dd>{p.note && <><dt>Note</dt><dd>{p.note}</dd></>}</dl></>}
        {p.kind === 'cite-claim' && (
          <dl>
            <dt>Claim</dt><dd>{c.questTitle}</dd>
            <dt>Source</dt><dd><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.sourceUrl}</a></dd>
            <dt>Where it says so</dt><dd>{p.quote}</dd>
          </dl>
        )}
      </div>
      <ul className="checklist">{CHECKS[p.kind].map((t) => <li key={t}><label><input type="checkbox" /> {t}</label></li>)}</ul>
      <div className="actions">
        <input className="grow" value={comment} placeholder="Optional note to the volunteer" onChange={(e) => setComment(e.target.value)} />
        <button className="btn" onClick={() => { if (!comment.trim()) { alert('Say what to fix.'); return; } void rejectImpl(c.id, comment.trim()); }}>Send back</button>
        <button className="btn primary" onClick={() => { void controller.run('approve', { contributionId: c.id, comment: comment.trim() || undefined }, { viaUi: true }); }}>Approve</button>
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
    <div className="queue">
      <div className="section-head">
        <h1>Review queue</h1>
        <p className="muted">Read each submission. Approve it, or send it back with one clear reason. You can also ask your agent to approve by id.</p>
      </div>
      <div className="field inline"><label htmlFor="rname">Your first name</label><input id="rname" value={profile.name} placeholder="Tom" maxLength={30} onChange={(e) => setState({ profile: { ...profile, name: e.target.value } })} /></div>
      {pending.length === 0 ? <div className="empty">Nothing waiting. Submissions from the volunteer tab appear here live.</div> : <ul className="reviews">{pending.map((c) => <Item key={c.id} c={c} />)}</ul>}
      {done.length > 0 && (
        <div className="mine"><h2>Reviewed</h2><ul>{done.map((c) => (
          <li key={c.id} className="mine-item">
            <StateChip state={c.status} /> {c.questTitle} · {c.volunteerName}
            {c.status === 'approved' && c.payload.kind !== 'cite-claim' && <button className="btn small" type="button" onClick={() => { void stageInId(c); }}>Stage in iD</button>}
          </li>
        ))}</ul></div>
      )}
    </div>
  );
}
