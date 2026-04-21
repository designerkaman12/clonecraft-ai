'use client';
import { useStore } from '@/lib/store';
import {
  BarChart2, Package, Palette, PenLine, Image,
  CheckCircle2, Loader2, Search, Brain, Sparkles, Wand2, ImageIcon,
  ChevronRight
} from 'lucide-react';

const STEPS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  idle:                { label: 'Ready to generate',         icon: <BarChart2 size={16} />,   color: 'var(--text-muted)' },
  scraping:            { label: 'Extracting product data…',  icon: <Search size={16} />,      color: 'var(--cyan)' },
  analyzing:           { label: 'Analyzing design style…',   icon: <Brain size={16} />,       color: 'var(--violet)' },
  generating_content:  { label: 'Writing copy with AI…',     icon: <PenLine size={16} />,     color: 'var(--indigo)' },
  generating_prompts:  { label: 'Building image prompts…',   icon: <Wand2 size={16} />,       color: 'var(--amber)' },
  generating_images:   { label: 'Generating images…',        icon: <ImageIcon size={16} />,   color: 'var(--emerald)' },
  complete:            { label: 'All creatives ready!',      icon: <CheckCircle2 size={16} />, color: 'var(--emerald)' },
};

export default function CenterPanel() {
  const { session } = useStore();
  const { currentStep, productData, referenceProductData, designSystem, generatedContent, imageSlots } = session;
  const stepInfo = STEPS[currentStep] || STEPS.idle;
  const isRunning = ['scraping','analyzing','generating_content','generating_prompts','generating_images'].includes(currentStep);

  return (
    <div className="panel panel-center">
      {/* Status Bar */}
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart2 size={13} style={{ color: 'var(--text-muted)' }} />
          <div className="panel-title">Analysis & Plan</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: stepInfo.color }}>{stepInfo.icon}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{stepInfo.label}</span>
          {isRunning && <Loader2 size={13} style={{ color: 'var(--indigo)', animation: 'spin 0.7s linear infinite' }} />}
        </div>
      </div>

      <div className="panel-body">
        {/* Idle State */}
        {currentStep === 'idle' && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ margin: '0 auto 16px', width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(99,102,241,0.12)' }}>
              <Sparkles size={24} style={{ color: 'var(--indigo)' }} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Configure & Generate
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto', lineHeight: 1.7 }}>
              Fill in your product details on the left and click{' '}
              <strong style={{ color: 'var(--indigo)' }}>Generate Creatives</strong> to begin.
            </p>
            {/* Quick step guide */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
              {[
                ['1', 'Enter Product', 'Name + links'],
                ['2', 'Configure', 'Style & platform'],
                ['3', 'Generate', 'AI creates 7 images'],
                ['4', 'Export', 'Download ZIP'],
              ].map(([num, title, desc]) => (
                <div key={num} style={{
                  background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                  borderRadius: 12, padding: '12px 14px', flex: '1 1 90px', minWidth: 90,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>{num}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product Data */}
        {productData?.title && (
          <div className="content-section">
            <div className="content-section-header">
              <Package size={11} />
              Your Product
            </div>
            <div className="content-section-body">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {productData.title}
              </div>
              {productData.category && (
                <span className="badge badge-cyan" style={{ marginBottom: 8, display: 'inline-flex' }}>{productData.category}</span>
              )}
              {productData.bullets?.length > 0 && (
                <ul style={{ paddingLeft: 14, marginTop: 8 }}>
                  {productData.bullets.slice(0, 5).map((b: string, i: number) => (
                    <li key={i} style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Design System */}
        {designSystem && (
          <div className="content-section">
            <div className="content-section-header">
              <Palette size={11} />
              Reference Design System
            </div>
            <div className="content-section-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  ['Layout', designSystem.layoutStyle],
                  ['Placement', designSystem.productPlacement],
                  ['Text Zone', designSystem.textPlacement],
                  ['Background', designSystem.backgroundType],
                  ['Lighting', designSystem.lightingStyle],
                  ['Typography', designSystem.typographyFeel],
                  ['Color Mood', designSystem.colorMood],
                  ['Tone', designSystem.overallTone],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-card)', borderRadius: 7, padding: '6px 10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generated Copy */}
        {generatedContent && (
          <div className="content-section">
            <div className="content-section-header">
              <PenLine size={11} />
              Generated Copy
            </div>
            <div className="content-section-body">
              {generatedContent.headlines?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div className="form-label" style={{ marginBottom: 6 }}>Headlines</div>
                  {generatedContent.headlines.slice(0, 3).map((h: string, i: number) => (
                    <div key={i} style={{
                      fontSize: 12, color: 'var(--text-primary)', fontWeight: 600,
                      marginBottom: 5, padding: '5px 10px',
                      background: 'rgba(99,102,241,0.07)',
                      borderRadius: 6, borderLeft: '2.5px solid var(--indigo)',
                    }}>
                      {h}
                    </div>
                  ))}
                </div>
              )}
              {generatedContent.tagline && (
                <div style={{ marginBottom: 10 }}>
                  <div className="form-label" style={{ marginBottom: 4 }}>Tagline</div>
                  <div style={{ fontSize: 13, color: 'var(--indigo)', fontStyle: 'italic', fontWeight: 500 }}>
                    "{generatedContent.tagline}"
                  </div>
                </div>
              )}
              {generatedContent.featurePoints?.length > 0 && (
                <div className="content-tag-list" style={{ marginTop: 8 }}>
                  {generatedContent.featurePoints.slice(0, 5).map((f: string, i: number) => (
                    <span key={i} className="content-tag">{f}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image Plan */}
        {imageSlots.length > 0 && (
          <div className="content-section">
            <div className="content-section-header" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ImageIcon size={11} />
                Image Plan
              </span>
              <span className="badge badge-indigo">{imageSlots.length} images</span>
            </div>
            <div className="content-section-body" style={{ padding: 0 }}>
              {imageSlots.map((slot, i) => (
                <PromptRow key={slot.id} slot={slot} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptRow({ slot, index }: { slot: any; index: number }) {
  const { setSelectedSlotId, setActivePanel } = useStore();
  const statusProps: Record<string, { color: string; dot: string }> = {
    pending:    { color: 'var(--text-muted)',  dot: '#d1d5db' },
    generating: { color: 'var(--amber)',       dot: '#f59e0b' },
    done:       { color: 'var(--emerald)',     dot: '#10b981' },
    error:      { color: 'var(--rose)',        dot: '#f43f5e' },
  };
  const sp = statusProps[slot.status] || statusProps.pending;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onClick={() => { setSelectedSlotId(slot.id); setActivePanel('right'); }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{slot.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: sp.dot,
            boxShadow: slot.status === 'generating' ? `0 0 6px ${sp.dot}` : undefined,
          }} />
          <span style={{ fontSize: 10, color: sp.color, fontWeight: 600, textTransform: 'capitalize' }}>
            {slot.status}
          </span>
        </div>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
      <div style={{ padding: '0 12px 9px 40px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
        {slot.prompt?.substring(0, 110)}{slot.prompt?.length > 110 ? '…' : ''}
      </div>
    </div>
  );
}
