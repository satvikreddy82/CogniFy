import React, { useState, useRef, useEffect } from 'react';
import { Palette, Sun, Moon, Monitor, Check, ChevronDown } from 'lucide-react';
import { useTheme, THEMES } from '../context/ThemeContext';
import type { ThemeId, AppearanceMode } from '../context/ThemeContext';
import { clsx } from 'clsx';

interface ThemeSelectorProps {
  variant?: 'floating' | 'inline' | 'topbar';
  className?: string;
}

export function ThemeSelector({ variant = 'inline', className = '' }: ThemeSelectorProps) {
  const { theme, appearance, setTheme, setAppearance, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div
      ref={dropdownRef}
      className={clsx('relative inline-flex items-center gap-2 select-none', className)}
    >
      {/* Light / Dark Quick Switcher */}
      <div
        className="flex items-center p-0.5 rounded-full border shadow-sm transition-colors"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <button
          type="button"
          onClick={() => setAppearance('light')}
          className={clsx(
            'p-1.5 rounded-full transition-all',
            appearance === 'light'
              ? 'text-white shadow-sm'
              : 'text-muted hover:text-default'
          )}
          style={{
            backgroundColor: appearance === 'light' ? 'var(--primary)' : 'transparent',
          }}
          title="Light mode"
          aria-label="Light mode"
        >
          <Sun className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setAppearance('dark')}
          className={clsx(
            'p-1.5 rounded-full transition-all',
            appearance === 'dark'
              ? 'text-white shadow-sm'
              : 'text-muted hover:text-default'
          )}
          style={{
            backgroundColor: appearance === 'dark' ? 'var(--primary)' : 'transparent',
          }}
          title="Dark mode"
          aria-label="Dark mode"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setAppearance('system')}
          className={clsx(
            'p-1.5 rounded-full transition-all',
            appearance === 'system'
              ? 'text-white shadow-sm'
              : 'text-muted hover:text-default'
          )}
          style={{
            backgroundColor: appearance === 'system' ? 'var(--primary)' : 'transparent',
          }}
          title="System preference"
          aria-label="System preference"
        >
          <Monitor className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Theme Picker Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-all hover:shadow',
          isOpen ? 'ring-2 ring-primary ring-opacity-40' : ''
        )}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-default)',
        }}
        title="Select color archetype"
      >
        <span
          className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20"
          style={{ backgroundColor: currentTheme.primary }}
        />
        <span className="max-w-[110px] truncate hidden sm:inline">{currentTheme.label}</span>
        <Palette className="w-3.5 h-3.5 text-muted shrink-0 sm:hidden" />
        <ChevronDown
          className={clsx('w-3 h-3 text-muted transition-transform shrink-0', isOpen ? 'rotate-180' : '')}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-brand-lg p-2.5 shadow-2xl border z-50 animate-fade-in"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <Palette className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              <span className="text-xs font-bold text-default uppercase tracking-wider">
                9 Color Themes
              </span>
            </div>
            <span className="text-[10px] text-muted capitalize px-1.5 py-0.5 rounded bg-surface-2">
              {appearance} mode
            </span>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {THEMES.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id as ThemeId);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center justify-between p-2 rounded-brand text-left text-xs transition-all',
                    active
                      ? 'bg-primary/10 font-semibold'
                      : 'hover:bg-surface-2'
                  )}
                  style={{
                    backgroundColor: active ? 'var(--surface-2)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center -space-x-1 shrink-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm z-10"
                        style={{ backgroundColor: t.primary }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: t.secondary }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-default font-medium truncate flex items-center gap-1.5">
                        <span>{t.label}</span>
                        <span className="text-[10px] text-muted uppercase font-normal">
                          ({t.id.replace('theme-', 'T-')})
                        </span>
                      </div>
                      <p className="text-[11px] text-muted truncate">{t.description}</p>
                    </div>
                  </div>

                  {active && (
                    <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
