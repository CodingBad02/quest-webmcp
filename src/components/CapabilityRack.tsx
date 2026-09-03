import { useSyncExternalStore } from 'react';
import type { RackItem } from '@gatherlight/quest-tools';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { controller } from '../webmcp/tools';
import { useAppState } from '../state/store';
import { useMediaQuery } from '../hooks/useMediaQuery';

const TAG: Partial<Record<RackItem['status'], string>> = { new: 'New', executing: 'Running' };

function describe(r: RackItem): string {
  if (r.status === 'locked') return r.reason ?? 'Locked.';
  if (r.status === 'removing') return 'No longer needed.';
  if (r.status === 'executing') return `Running ${r.name}…`;
  return r.description;
}

function Item({ r }: { r: RackItem }) {
  const tag = TAG[r.status];
  return (
    <li className="qt-tool" data-state={r.status} tabIndex={0} aria-label={`${r.name}: ${r.status}${r.reason ? `. ${r.reason}` : ''}`}>
      <span className="qt-tool-dot" aria-hidden="true" />
      <span className="qt-tool-name">{r.name}</span>
      {tag && <span className="qt-tool-tag">{tag}</span>}
      <span className="qt-tool-desc">{describe(r)}</span>
    </li>
  );
}

/** The portable rack markup (DESIGN.md §5a). qt.css owns its look; this file only decides where it sits. */
function RackPanel({ rack }: { rack: RackItem[] }) {
  const role = useAppState((s) => s.role);
  const empty = rack.length === 0;
  const emptyMessage = role === 'reviewer' ? 'approve-contribution appears when something is waiting for review.' : 'No tools right now.';
  return (
    <aside id="capability-rack" className="qt qt-rack rack" aria-label="Agent tools">
      <h2 className="qt-rack-title">Agent tools</h2>
      <p className="qt-rack-runtime">{controller.runtime()}</p>
      <ul className="qt-rack-list" aria-live="polite">
        {rack.map((r) => <Item key={r.name} r={r} />)}
      </ul>
      <p className="qt-rack-empty" hidden={!empty}>{emptyMessage}</p>
    </aside>
  );
}

export function CapabilityRack() {
  const rack = useSyncExternalStore(controller.subscribe, controller.getRack, controller.getRack);
  const narrow = useMediaQuery('(max-width: 899.98px)');
  const count = rack.filter((r) => r.status !== 'removing' && r.status !== 'locked').length;

  if (!narrow) return <RackPanel rack={rack} />;
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="sky" size="sm" className="fixed top-3 right-4 z-30 bg-[rgba(10,14,28,.6)] backdrop-blur-md">{count} {count === 1 ? 'tool' : 'tools'}</Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[80dvh]">
        <DrawerTitle className="sr-only">Agent tools</DrawerTitle>
        <div className="overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]"><RackPanel rack={rack} /></div>
      </DrawerContent>
    </Drawer>
  );
}
