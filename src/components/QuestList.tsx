import { openQuest, useAppState } from '../state/store';
import { findQuestsImpl } from '../webmcp/tools';
import type { Quest, QuestType } from '../types';

const ICON: Record<QuestType, string> = { 'verify-hours': '☏', 'access-photo': '⧉', 'plain-rewrite': '¶' };
const KIND: Record<QuestType, string> = { 'verify-hours': 'Confirm hours', 'access-photo': 'Step-free entry', 'plain-rewrite': 'Plain rewrite' };

function Card({ q }: { q: Quest }) {
  return (
    <li>
      <button className="card" onClick={() => openQuest(q.id)}>
        <span className={`kind kind-${q.type}`}><span aria-hidden="true">{ICON[q.type]}</span> {KIND[q.type]}</span>
        <strong className="card-title">{q.placeName}</strong>
        <span className="card-meta">
          about {q.estimatedMinutes} min · {q.remote ? 'from home' : 'in person'}{q.address ? ` · ${q.address}` : ''}
        </span>
      </button>
    </li>
  );
}

export function QuestList() {
  const quests = useAppState((s) => s.quests);
  const profile = useAppState((s) => s.profile);
  const contributions = useAppState((s) => s.contributions);
  const source = useAppState((s) => s.questSource);
  const matches = findQuestsImpl({});
  const mine = contributions.filter((c) => c.volunteerName === (profile.name || 'A volunteer'));

  if (source === 'loading') return <div className="empty">Loading real places from OpenStreetMap…</div>;

  return (
    <div className="questlist">
      <div className="section-head">
        <h1>Quests that fit {profile.minutesAvailable} minutes</h1>
        <p className="muted">Each one fixes a real gap in the public map, or makes one help page easier to read. Ask your browser agent, or pick one.</p>
      </div>
      {matches.length === 0 ? (
        <div className="empty">No quests match right now. Try more minutes, or tick another skill.</div>
      ) : (
        <ul className="cards">{matches.map((q) => <Card key={q.id} q={q} />)}</ul>
      )}
      {mine.length > 0 && (
        <div className="mine">
          <h2>Your contributions</h2>
          <ul>
            {mine.map((c) => (
              <li key={c.id} className={`mine-item status-${c.status}`}>
                <span className="status">{c.status}</span> {c.questTitle}
                {c.reviewComment && <span className="muted"> · {c.reviewComment}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted small">{quests.length} open quests in central Bengaluru. Showing the five that fit you best.</p>
    </div>
  );
}
