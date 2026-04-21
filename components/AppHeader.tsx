'use client';
import { useStore } from '@/lib/store';
import { Zap, Check, RotateCcw, Wifi, ChevronRight } from 'lucide-react';

const STEPS = [
  { key: 'scraping',           label: 'Extract'   },
  { key: 'analyzing',          label: 'Analyze'   },
  { key: 'generating_content', label: 'Copywrite' },
  { key: 'generating_prompts', label: 'Prompt'    },
  { key: 'generating_images',  label: 'Generate'  },
  { key: 'complete',           label: 'Done'      },
];

export default function AppHeader() {
  const { session, resetSession } = useStore();
  const step = session.currentStep;
  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <header className="app-header">
      {/* Logo */}
      <div className="logo">
        <div className="logo-icon">
          <Zap size={15} strokeWidth={2.5} />
        </div>
        <span className="logo-text">Clone<span>Craft</span></span>
        <span className="logo-badge">AI</span>
      </div>

      {/* Progress breadcrumb — only while running */}
      {step !== 'idle' && (
        <div className="header-center">
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {STEPS.map((s, i) => {
              const isDone   = step === 'complete' || stepIndex > i;
              const isActive = stepIndex === i && step !== 'complete';
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {i > 0 && (
                    <ChevronRight
                      size={10}
                      strokeWidth={2}
                      style={{ color: isDone ? 'var(--emerald)' : 'var(--border)', flexShrink: 0 }}
                    />
                  )}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 99,
                      fontSize: 11, fontWeight: 600,
                      background: isDone
                        ? 'rgba(16,185,129,0.1)'
                        : isActive
                          ? 'rgba(99,102,241,0.1)'
                          : 'transparent',
                      color: isDone
                        ? 'var(--emerald)'
                        : isActive
                          ? 'var(--indigo)'
                          : 'var(--text-muted)',
                      border: isActive ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                    }}
                  >
                    {isDone ? (
                      <Check size={9} strokeWidth={3} />
                    ) : isActive ? (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--indigo)',
                        animation: 'pulse 1s infinite',
                        display: 'inline-block',
                      }} />
                    ) : (
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} />
                    )}
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="header-right">
        {step !== 'idle' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={resetSession}
            id="btn-reset-session"
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}
          data-tooltip="API Connected"
        >
          <Wifi size={12} />
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>API</span>
        </div>
      </div>
    </header>
  );
}
