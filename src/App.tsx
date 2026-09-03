import { useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { getState, loadContributionsFromStore, reloadQuests, setState, subscribe, toast, useAppState } from './state/store';
import { onQuestEvent } from './channel/broadcast';
import { controller } from './webmcp/tools';
import { CapabilityRack } from './components/CapabilityRack';
import { QuestList } from './components/QuestList';
import { Workspace } from './components/Workspace';
import { ReviewerQueue } from './components/ReviewerQueue';
import { Sky } from './components/Sky';
import { LogoCloud } from './components/LogoCloud';

export default function App() {
  const role = useAppState((s) => s.role);
  const activeQuestId = useAppState((s) => s.activeQuestId);

  useEffect(() => {
    reloadQuests().then(() => controller.refresh());
    loadContributionsFromStore();
    const unsubStore = subscribe(() => controller.refresh());
    controller.refresh();
    const unsubEvents = onQuestEvent(async (e) => {
      await loadContributionsFromStore();
      const s = getState();
      if (e.type === 'contribution:approved' && s.role === 'volunteer') {
        const c = s.contributions.find((x) => x.id === e.contributionId);
        const lit = c?.payload.kind === 'cite-claim' ? 'Your source is on the graph.' : 'Your star is lit.';
        toast(`${e.reviewerName} approved your work on ${c?.questTitle.replace(/^.*?: /, '') ?? 'a quest'}. ${lit}`);
        if (s.activeQuestId === e.questId) setState({ workspace: 'approved' });
      }
      if (e.type === 'contribution:stale' && s.role === 'volunteer') {
        toast(`Marked out of date: ${e.comment}`);
        if (s.activeQuestId === e.questId) setState({ workspace: 'in-workspace' });
      }
      if (e.type === 'contribution:rejected' && s.role === 'volunteer') {
        toast(`Sent back: ${e.comment}`);
        if (s.activeQuestId === e.questId) setState({ workspace: 'in-workspace', checkErrors: [e.comment] });
      }
      if (e.type === 'contribution:submitted' && s.role === 'reviewer') toast('New submission to review.');
    });
    // The store is the source of truth; poll while the tab is visible so an approval
    // from another session (no BroadcastChannel across origins or profiles) still lands.
    const poll = setInterval(() => { if (document.visibilityState === 'visible') loadContributionsFromStore(); }, 4000);
    return () => { unsubStore(); unsubEvents(); clearInterval(poll); };
  }, []);

  const base = import.meta.env.BASE_URL;
  const otherRole = role === 'reviewer' ? base : `${base}?role=reviewer`;
  const hero = role === 'volunteer' && !activeQuestId;

  return (
    <div className="app flex min-h-screen flex-col overflow-x-hidden" data-role={role}>
      <header className="topbar absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-2.5 px-(--gutter) text-sky-ink">
        <a className="brand flex items-center gap-2 text-[17px] font-semibold tracking-[-.012em] text-sky-ink no-underline" href={role === 'reviewer' ? `${base}?role=reviewer` : base} aria-label="Quest home">
          <svg className="text-gold" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="3" fill="currentColor" /><circle cx="4" cy="6" r="1.6" fill="currentColor" opacity=".55" /><circle cx="18" cy="5" r="1.3" fill="currentColor" opacity=".55" /><circle cx="17" cy="17" r="1.6" fill="currentColor" opacity=".55" /><path d="M11 11L4 6M11 11l7-6M11 11l6 6" stroke="currentColor" strokeWidth=".8" opacity=".4" /></svg>
          <span>Quest</span>
        </a>
        <span className="flex-1" />
        <Badge asChild variant="skyLink" className="min-h-8 px-3 text-[13px] max-md:mr-24"><a href={otherRole} target="_blank" rel="noreferrer">{role === 'reviewer' ? 'Volunteer' : 'Review'} <ArrowUpRight aria-hidden="true" /></a></Badge>
      </header>

      <Sky size={hero ? 'hero' : 'band'} />
      {hero && <LogoCloud />}

      <main className="layout grid w-full flex-1 grid-cols-[minmax(680px,760px)_320px] items-start justify-center gap-6 px-6 pt-9 pb-18 max-xl:grid-cols-[minmax(560px,1fr)_280px] max-md:grid-cols-1 max-md:px-4 max-md:pt-6 max-md:pb-12">
        <section className="work min-w-0" aria-live="polite">
          {role === 'reviewer' ? <ReviewerQueue /> : activeQuestId ? <Workspace /> : <QuestList />}
        </section>
        <aside className="rack-col">
          <CapabilityRack />
        </aside>
      </main>

      <Toaster position="bottom-center" />
    </div>
  );
}
