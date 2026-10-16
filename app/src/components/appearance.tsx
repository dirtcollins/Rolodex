"use client";
import { useEffect, useState } from 'react';
type Theme = 'system' | 'light' | 'dark';
export function Appearance({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => { const saved = document.documentElement.dataset.theme; if (saved === 'light' || saved === 'dark') setTheme(saved); }, []);
  const pick = (value: Theme) => { setTheme(value); document.documentElement.dataset.theme = value; try { localStorage.setItem('rx-theme', value); } catch {} };
  return <div className={compact ? 'appearance-compact' : 'card card-pad appearance'}><h3>Appearance</h3>{!compact && <p className="muted">Choose a comfortable workspace.</p>}<div className="chip-pick" role="radiogroup" aria-label="Color theme">{(['system','light','dark'] as const).map((t) => <label key={t}><input type="radio" name={compact ? 'theme-short' : 'theme'} checked={theme === t} onChange={() => pick(t)} /><span>{t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}</span></label>)}</div></div>;
}
