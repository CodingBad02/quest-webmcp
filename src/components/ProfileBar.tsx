import { setState, useAppState } from '../state/store';

const SKILLS = ['phone', 'photo', 'visit'];

export function ProfileBar() {
  const profile = useAppState((s) => s.profile);
  const set = (patch: Partial<typeof profile>) => setState({ profile: { ...profile, ...patch } });
  const toggle = (k: string) => set({ skills: profile.skills.includes(k) ? profile.skills.filter((x) => x !== k) : [...profile.skills, k] });

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
