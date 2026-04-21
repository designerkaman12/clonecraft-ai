'use client';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function AppHeader() {
  const router = useRouter();
  const { session, resetSession } = useStore();
  const step = session.currentStep;

  const STEPS = [
    { key: 'scraping',           label: 'Extracting' },
    { key: 'analyzing',          label: 'Analyzing' },
    { key: 'generating_content', label: 'Copywriting' },
    { key: 'generating_prompts', label: 'Prompting'  },
    { key: 'generating_images',  label: 'Generating' },
    { key: 'complete',           label: 'Done'       },
  ];

  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <header className="app-header">
      {/* Logo */}
      <div className="logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
        <div className="logo-icon">⚡</div>
        <span className="logo-text">CloneCraft</span>
        <span className="logo-badge">AI</span>
      </div>

      {/* Progress Steps */}
      {step !== 'idle' && (
        <div className="header-center">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {STEPS.map((s, i) => {
              const isDone   = stepIndex > i || step === 'complete';
              const isActive = stepIndex === i && step !== 'complete';
              return (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && <div className="step-divider" />}
                  <div className={`step-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                    <div className="step-dot" />
                    <span className="step-label">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="header-right">
        {session.currentStep !== 'idle' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={resetSession}
            id="btn-reset-session"
            data-tooltip="Start over"
          >
            🔄 Reset
          </button>
        )}
        <div
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--emerald)',
            boxShadow: '0 0 8px rgba(16,185,129,0.6)',
          }}
          data-tooltip="API Connected"
        />
      </div>
    </header>
  );
}
