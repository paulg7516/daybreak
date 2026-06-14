// src/renderer/components/ThemeToggle.tsx
import { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { getThemePref, setThemePref, type ThemePref } from '../theme';

const OPTS: { pref: ThemePref; Icon: typeof Sun; label: string }[] = [
  { pref: 'light', Icon: Sun, label: 'Light' },
  { pref: 'dark', Icon: Moon, label: 'Dark' },
  { pref: 'system', Icon: Monitor, label: 'System' },
];

// Light / Dark / System appearance, as a compact vertical control for the nav rail.
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const choose = (p: ThemePref) => { setThemePref(p); setPref(p); };
  return (
    <div className="flex flex-col items-center gap-1" role="group" aria-label="Appearance">
      {OPTS.map(({ pref: p, Icon, label }) => (
        <button
          key={p}
          type="button"
          title={label}
          aria-label={`${label} appearance`}
          aria-pressed={pref === p}
          onClick={() => choose(p)}
          className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
            pref === p ? 'bg-accent/15 text-accent' : 'text-ink-3 hover:bg-panel-2 hover:text-ink'
          }`}
        >
          <Icon size={15} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
