import { useRef, useState } from 'react';
import { setPlace, setState, useAppState } from '../state/store';
import { geocode, reverseGeocode } from '../data/geocode';
import { controller } from '../webmcp/tools';
import type { Place } from '../types';

const SKILLS = ['phone', 'photo', 'visit', 'research'];
const GEOCODE_FAIL = 'Could not find that place. Try a neighbourhood and city, e.g. "Koramangala, Bengaluru".';
const LOCATION_OFF = 'Location is off. Type a place instead.';

type Busy = 'set' | 'locate' | null;

export function ProfileBar() {
  const profile = useAppState((s) => s.profile);
  const set = (patch: Partial<typeof profile>) => setState({ profile: { ...profile, ...patch } });
  const toggle = (k: string) => set({ skills: profile.skills.includes(k) ? profile.skills.filter((x) => x !== k) : [...profile.skills, k] });

  const nearRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);

  async function apply(place: Place | null, failMessage: string) {
    if (!place) { setNote(failMessage); return; }
    setNote(null);
    await setPlace(place);
    controller.refresh();
  }

  const onSet = async () => {
    if (busy) return;
    const value = nearRef.current?.value ?? '';
    setBusy('set');
    try { await apply(await geocode(value), GEOCODE_FAIL); } finally { setBusy(null); }
  };

  const onLocate = () => {
    if (busy) return;
    if (!('geolocation' in navigator)) { setNote(LOCATION_OFF); return; }
    setBusy('locate');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try { await apply(await reverseGeocode(pos.coords.latitude, pos.coords.longitude), LOCATION_OFF); } finally { setBusy(null); }
      },
      () => { setNote(LOCATION_OFF); setBusy(null); },
      { timeout: 8000 },
    );
  };

  return (
    <div className="profile">
      <div className="field">
        <label htmlFor="name">Your first name</label>
        <input id="name" value={profile.name} placeholder="Priya" maxLength={30} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="minutes">Minutes you have</label>
        <input id="minutes" type="number" min={3} max={120} value={profile.minutesAvailable} onChange={(e) => set({ minutesAvailable: Math.max(3, Number(e.target.value) || 3) })} />
      </div>
      <div className="field near">
        <label htmlFor="near">Near</label>
        <div className="near-row">
          <input id="near" ref={nearRef} key={profile.place.label} defaultValue={profile.place.label} maxLength={60} placeholder="Koramangala, Bengaluru" />
          <button type="button" className="btn small" onClick={onSet} disabled={busy !== null}>{busy === 'set' ? 'Finding…' : 'Set'}</button>
          <button type="button" className="btn small" onClick={onLocate} disabled={busy !== null}>{busy === 'locate' ? 'Finding…' : 'Use my location'}</button>
        </div>
        {note && <p className="help">{note}</p>}
      </div>
      <fieldset className="field chips">
        <legend>You can</legend>
        {SKILLS.map((k) => (
          <label key={k} className={`chip ${profile.skills.includes(k) ? 'on' : ''}`}>
            <input type="checkbox" checked={profile.skills.includes(k)} onChange={() => toggle(k)} /> {k}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
