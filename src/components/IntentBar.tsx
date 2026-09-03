/**
 * The one entry point on the landing: where you are, how long you have, go. It runs the same
 * `find-quests` logic the agent runs, and shows the sentence to say to the agent instead.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, LocateFixed, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { setPlace, setState, toast, useAppState } from '../state/store';
import { reverseGeocode, suggest } from '../data/geocode';
import { controller } from '../webmcp/tools';
import type { Place } from '../types';

const MINUTES = [10, 20, 45];
const LOCATION_OFF = 'Location is off. Type a place instead.';

export function IntentBar() {
  const profile = useAppState((s) => s.profile);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced Photon lookup, biased to the current place; each keystroke cancels the last request.
  useEffect(() => {
    abortRef.current?.abort();
    if (q.trim().length < 2) { setHits([]); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(() => { void suggest(q, profile.place, ctrl.signal).then((r) => { if (!ctrl.signal.aborted) setHits(r); }); }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, profile.place]);

  async function choose(place: Place | null, fail: string) {
    setOpen(false);
    setQ('');
    if (!place) { setNote(fail); setBusy(false); return; }
    setNote(null);
    setBusy(true);
    try { await setPlace(place); controller.refresh(); } finally { setBusy(false); }
  }

  const locate = () => {
    if (!('geolocation' in navigator)) { setNote(LOCATION_OFF); return; }
    setOpen(false);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => { await choose(await reverseGeocode(pos.coords.latitude, pos.coords.longitude), LOCATION_OFF); },
      () => { setNote(LOCATION_OFF); setBusy(false); },
      { timeout: 8000 },
    );
  };

  // The button runs the same operation the agent runs, then shows the list it produced.
  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    await controller.run('find', {}, { viaUi: true });
    document.getElementById('quests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sentence = `Find me a ${profile.minutesAvailable}-minute quest near ${profile.place.label}.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(sentence); setCopied(true); toast('Copied.'); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked: the text is visible anyway */ }
  };

  return (
    <div className="pointer-events-auto grid gap-3">
      <form onSubmit={(e) => { void find(e); }} className="flex max-w-[760px] items-stretch gap-1 rounded-full border border-sky-line bg-[rgba(10,14,28,.55)] p-1.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,.8)] backdrop-blur-md max-sm:flex-col max-sm:rounded-2xl">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-left text-sky-ink transition-colors hover:bg-sky-fill aria-expanded:bg-sky-fill" aria-label="Where are you?" disabled={busy}>
              <MapPin className="size-4 shrink-0 text-gold" aria-hidden="true" />
              <span className="min-w-0 truncate text-[15px]">{busy ? 'Finding…' : profile.place.label}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={10} className="w-(--radix-popover-trigger-width) min-w-[300px] p-0">
            <Command shouldFilter={false}>
              <CommandInput id="near" placeholder="Where are you?" value={q} onValueChange={setQ} maxLength={60} autoFocus />
              <CommandList>
                <CommandGroup>
                  <CommandItem value="__locate" onSelect={locate}><LocateFixed aria-hidden="true" /> Use my location</CommandItem>
                </CommandGroup>
                {hits.length > 0 && (
                  <CommandGroup heading="Places">
                    {hits.map((h) => <CommandItem key={`${h.lat},${h.lon}`} value={h.label} onSelect={() => { void choose(h, ''); }}><MapPin aria-hidden="true" /> {h.label}</CommandItem>)}
                  </CommandGroup>
                )}
                {q.trim().length >= 2 && hits.length === 0 && <CommandEmpty>No place found. Try a neighbourhood and city.</CommandEmpty>}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="hidden w-px self-stretch bg-sky-line sm:block" aria-hidden="true" />

        <div className="flex items-center gap-2 px-2 max-sm:justify-between">
          <span className="text-[13px] text-sky-muted">I have</span>
          <ToggleGroup type="single" value={String(profile.minutesAvailable)} onValueChange={(v) => { if (v) setState({ profile: { ...profile, minutesAvailable: Number(v) } }); }} aria-label="Minutes you have">
            {MINUTES.map((m) => <ToggleGroupItem key={m} value={String(m)} variant="sky" size="sm" className="min-w-11 font-mono tabular-nums">{m}</ToggleGroupItem>)}
          </ToggleGroup>
          <span className="text-[13px] text-sky-muted">min</span>
        </div>

        <Button type="submit" variant="gold" className="shrink-0">Find quests <ArrowRight aria-hidden="true" /></Button>
      </form>
      {note && <p className="text-sm text-[#f2c9a0]">{note}</p>}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-sky-muted">
        <span>Or tell your agent:</span>
        <q className="text-sky-ink">{sentence}</q>
        <Button type="button" variant="sky" size="xs" onClick={copy} aria-label="Copy the sentence">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </p>
    </div>
  );
}
