import React from 'react';
import { Palette, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, THEMES, AppearanceMode, ThemeId } from '../../context/ThemeContext';

export default function AppearanceSettingsPage() {
  const { theme, appearance, setTheme, setAppearance } = useTheme();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-default">Appearance & Themes</h1>
        <p className="text-sm text-muted">Personalize your visual experience across CogniFy's OBE workspace.</p>
      </div>

      {/* Mode Selection */}
      <div className="card p-6 border border-border space-y-4">
        <div>
          <h2 className="text-base font-bold text-default">Display Mode</h2>
          <p className="text-xs text-muted">Choose between light, dark, or sync with your system preference.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'light', label: 'Light Mode', icon: Sun, desc: 'Clean, high-clarity daylight interface' },
            { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'Deep surfaces for reduced eye strain' },
            { id: 'system', label: 'System Default', icon: Monitor, desc: 'Matches your OS appearance automatically' },
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = appearance === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setAppearance(mode.id as AppearanceMode)}
                className={`p-4 rounded-brand border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-surface-2 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-brand ${isSelected ? 'bg-primary text-white' : 'bg-surface text-muted'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-default">{mode.label}</h3>
                  <p className="text-xs text-muted mt-0.5 leading-snug">{mode.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Palette Selection (9 Curated Themes) */}
      <div className="card p-6 border border-border space-y-4">
        <div>
          <h2 className="text-base font-bold text-default flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Curated Color Palettes (9 Archetypes)
          </h2>
          <p className="text-xs text-muted">Select an academic or modern accent palette tailored for accessibility and contrast.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {THEMES.map((item) => {
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`p-4 rounded-brand border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                    : 'border-border bg-surface-2 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shadow-sm flex-shrink-0"
                      style={{ backgroundColor: item.primary }}
                    />
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shadow-sm flex-shrink-0 -ml-3"
                      style={{ backgroundColor: item.secondary }}
                    />
                  </div>
                  {isSelected && (
                    <span className="badge badge-primary text-[10px] uppercase font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-default">{item.label}</h3>
                  <p className="text-xs text-muted mt-1 leading-snug">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
