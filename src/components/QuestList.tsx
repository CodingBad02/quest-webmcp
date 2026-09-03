import { useState, type JSX } from 'react';
import { ChevronDown, Phone, Quote, DoorOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { reloadQuests, useAppState } from '../state/store';
import { controller, findQuestsImpl } from '../webmcp/tools';
import type { Quest, QuestType } from '../types';
import { KnowledgeGraph } from './KnowledgeGraph';
import { StateChip } from './StateChip';

const ICON: Record<QuestType, JSX.Element> = {
  'verify-hours': <Phone aria-hidden="true" />,
  'access-photo': <DoorOpen aria-hidden="true" />,
  'cite-claim': <Quote aria-hidden="true" />,
};
export const KIND: Record<QuestType, string> = { 'verify-hours': 'Confirm hours', 'access-photo': 'Step-free entry', 'cite-claim': 'Cite a source' };
const FILTERS: [string, QuestType | 'all'][] = [['All', 'all'], ['Call', 'verify-hours'], ['Visit', 'access-photo'], ['Read', 'cite-claim']];

function Card({ q }: { q: Quest }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <button className="card group grid w-full min-h-[92px] grid-cols-[44px_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-4 gap-y-0.5 px-5 py-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))] active:scale-[.995] max-sm:grid-cols-[44px_minmax(0,1fr)] max-sm:grid-rows-[auto_auto_auto] max-sm:px-4" onClick={() => { void controller.run('open', { id: q.id }, { viaUi: true }); }}>
        <span className="row-span-2 grid size-11 place-items-center rounded-lg bg-secondary text-foreground transition-transform group-hover:scale-105 max-sm:row-span-3 [&_svg]:size-[18px]" aria-hidden="true">{ICON[q.type]}</span>
        <Badge variant="kind" className="col-start-2 row-start-1">{KIND[q.type]}</Badge>
        <strong className="card-title col-start-2 row-start-2 text-[17px] leading-[1.3] font-semibold tracking-[-.012em]">{q.placeName}</strong>
        <span className="col-start-3 row-span-2 max-w-[280px] text-right text-sm tabular-nums text-muted-foreground max-sm:col-start-2 max-sm:row-span-1 max-sm:row-start-3 max-sm:text-left">
          {q.estimatedMinutes} min · {q.remote ? 'from home' : 'in person'}{q.address ? ` · ${q.address}` : ''}
        </span>
      </button>
    </li>
  );
}

const SOURCE_LABEL = { loading: 'Loading', live: 'Live OpenStreetMap', cached: 'OpenStreetMap, cached', fallback: 'OpenStreetMap, offline copy', unavailable: 'OpenStreetMap unavailable' } as const;

export function QuestList() {
  const quests = useAppState((s) => s.quests);
  const profile = useAppState((s) => s.profile);
  const contributions = useAppState((s) => s.contributions);
  const source = useAppState((s) => s.questSource);
  const wdCampaigns = useAppState((s) => s.wdCampaigns);
  const openSources = useAppState((s) => s.openSources);
  const [type, setType] = useState<QuestType | 'all'>('all');
  const matches = findQuestsImpl(type === 'all' ? {} : { type });
  const mine = contributions.filter((c) => c.volunteerName === (profile.name || 'A volunteer'));
  const sourcesOpen = openSources || mine.at(-1)?.payload.kind === 'cite-claim';
  const claimIds = new Set(wdCampaigns.flatMap((c) => c.questIds));
  const sourced = contributions.filter((c) => claimIds.has(c.questId) && (c.status === 'approved' || c.status === 'landed')).length;
  const provenance = SOURCE_LABEL[source];
  const osmUnavailable = source === 'unavailable' && type !== 'cite-claim';

  return (
    <div id="quests" className="questlist scroll-mt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-[28px] leading-[1.15] font-medium tracking-[-.015em] text-balance">Quests near {profile.place.label}</h2>
        <ToggleGroup type="single" value={type} onValueChange={(v) => { if (v) setType(v as QuestType | 'all'); }} aria-label="Kind of quest">
          {FILTERS.map(([label, v]) => <ToggleGroupItem key={label} value={v} variant="outline" size="sm" className={v === 'all' ? 'min-w-12' : ''}>{label}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>

      {source === 'loading' ? (
        <ul className="cards overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)" aria-label={`Finding real gaps near ${profile.place.label}…`}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex min-h-[92px] items-center gap-4 border-b border-border px-5 last:border-b-0">
              <Skeleton className="size-11 rounded-lg" />
              <div className="grid flex-1 gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-56" /></div>
              <Skeleton className="h-3 w-28" />
            </li>
          ))}
        </ul>
      ) : matches.length === 0 ? (
        <div className="empty rounded-xl border border-dashed border-border bg-card/70 px-7 py-10 text-center text-muted-foreground">
          <p>{osmUnavailable ? `OpenStreetMap is unavailable for ${profile.place.label}.` : 'Nothing fits the current time and filter.'}</p>
          {osmUnavailable && <Button variant="outline" size="sm" className="mt-4" onClick={() => { void reloadQuests(); }}>Try again</Button>}
        </div>
      ) : (
        <ul className="cards overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)">{matches.map((q) => <Card key={q.id} q={q} />)}</ul>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{quests.length} open gaps in {profile.place.label}.</span>
        <Badge variant="mono" className="pill pill-source" title="Where quests come from">{provenance}</Badge>
      </p>

      {mine.length > 0 && (
        <div className="mine mt-10">
          <h2 className="font-display mb-3 text-[23px] leading-[1.2] font-medium tracking-[-.015em]">Your contributions</h2>
          <ul className="grid gap-2">
            {mine.map((c) => (
              <li key={c.id} className="mine-item flex flex-wrap items-baseline gap-2.5 text-sm">
                <StateChip state={c.status} pulse /> {c.questTitle}
                {c.via && c.via !== location.origin && <Badge variant="mono">via Survey</Badge>}
                {c.reviewComment && <span className="text-muted-foreground"> · {c.reviewComment}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {wdCampaigns.length > 0 && (
        <Collapsible id="sources" defaultOpen={sourcesOpen} className="mt-14 scroll-mt-6 border-t border-border pt-6">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 rounded-md py-1 text-left">
            <span className="font-display text-[23px] leading-[1.2] font-medium tracking-[-.015em]">Sources in {profile.place.label}</span>
            <span className="flex items-center gap-3 font-mono text-sm tabular-nums text-muted-foreground"><span>{sourced} / {claimIds.size} sourced</span><ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" /></span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3"><KnowledgeGraph /></CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
