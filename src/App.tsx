import { useEffect } from 'react';
import { getState, reloadShared, setState, subscribe, toast, useAppState } from './state/store';
import { buildCampaigns, loadQuests } from './data/overpass';
import { onQuestEvent } from './channel/broadcast';
import { syncToolsForState } from './webmcp/tools';
import { hasWebMCP } from './webmcp/registry';
import { CapabilityRack } from './components/CapabilityRack';
import { QuestList } from './components/QuestList';
import { Workspace } from './components/Workspace';
import { ReviewerQueue } from './components/ReviewerQueue';
import { ConstellationStrip } from './components/Constellation';
import { ConfirmModal } from './components/ConfirmModal';
import { ProfileBar } from './components/ProfileBar';

export default function App() {
  const role = useAppState((s) => s.role);
  const activeQuestId = useAppState((s) => s.activeQuestId);
  const source = useAppState((s) => s.questSource);
  const toastMsg = useAppState((s) => s.toast);

  useEffect(() => {
    loadQuests().then(({ quests, source }) => setState({ quests, campaigns: buildCampaigns(quests), questSource: source }));
    const unsubStore = subscribe(() => syncToolsForState(getState()));
    syncToolsForState(getState());
    const unsubEvents = onQuestEvent((e) => {
      reloadShared();
      const s = getState();
      if (e.type === 'contribution:approved' && s.role === 'volunteer') {
        const c = s.contributions.find((x) => x.id === e.contributionId);
        toast(`${e.reviewerName} approved your work on ${c?.questTitle.replace(/^.*?: /, '') ?? 'a quest'}. A star lit up.`);
        if (s.activeQuestId === e.questId) setState({ workspace: 'approved' });
      }
      if (e.type === 'contribution:rejected' && s.role === 'volunteer') {
        toast(`Sent back: ${e.comment}`);
        if (s.activeQuestId === e.questId) setState({ workspace: 'in-workspace', checkErrors: [e.comment] });
      }
      if (e.type === 'contribution:submitted' && s.role === 'reviewer') toast('New contribution to review.');
    });
    const onStorage = (ev: StorageEvent) => { if (ev.key === 'quest.state.v1') reloadShared(); };
    window.addEventListener('storage', onStorage);
    return () => { unsubStore(); unsubEvents(); window.removeEventListener('storage', onStorage); };
  }, []);

  const base = import.meta.env.BASE_URL;
  const otherRole = role === 'reviewer' ? base : `${base}?role=reviewer`;

  return (
    <div className="app" data-role={role}>
      <header className="topbar">
        <a className="brand" href={role === 'reviewer' ? `${base}?role=reviewer` : base} aria-label="Quest home">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="3" fill="currentColor" /><circle cx="4" cy="6" r="1.6" fill="currentColor" opacity=".55" /><circle cx="18" cy="5" r="1.3" fill="currentColor" opacity=".55" /><circle cx="17" cy="17" r="1.6" fill="currentColor" opacity=".55" /><path d="M11 11L4 6M11 11l7-6M11 11l6 6" stroke="currentColor" strokeWidth=".8" opacity=".4" /></svg>
          <span>Quest</span>
        </a>
        <span className={`pill source-${source}`} title="Where quests come from">
          {source === 'loading' ? 'Loading places' : source === 'live' ? 'Live OpenStreetMap' : source === 'cached' ? 'OpenStreetMap, cached' : 'OpenStreetMap, offline copy'}
        </span>
        <span className="spacer" />
        {!hasWebMCP && <span className="pill warn" title="Enable chrome://flags/#enable-webmcp-testing or use the ChatGPT desktop browser">WebMCP off. Manual mode</span>}
        <a className="pill link" href={otherRole} target="_blank" rel="noreferrer">
          {role === 'reviewer' ? 'Open volunteer tab' : 'Open reviewer tab'}
        </a>
      </header>

      <ConstellationStrip />

      <main className="layout">
        <section className="work" aria-live="polite">
          {role === 'reviewer' ? <ReviewerQueue /> : activeQuestId ? <Workspace /> : (<><ProfileBar /><QuestList /></>)}
        </section>
        <aside className="rack-col">
          <CapabilityRack />
        </aside>
      </main>

      <ConfirmModal />
      <div className="toast-region" role="status" aria-live="polite">{toastMsg && <div className="toast">{toastMsg}</div>}</div>
    </div>
  );
}
