'use client';
import { useStore } from '@/lib/store';

const STEP_LABELS: Record<string, { label: string; icon: string }> = {
  idle:                { label: 'Ready to generate',     icon: '🎯' },
  scraping:            { label: 'Extracting product data…', icon: '🔍' },
  analyzing:           { label: 'Analyzing reference style…', icon: '🧠' },
  generating_content:  { label: 'Writing copy with AI…', icon: '✍️' },
  generating_prompts:  { label: 'Building image prompts…', icon: '⚡' },
  generating_images:   { label: 'Generating images…',    icon: '🖼️' },
  complete:            { label: 'All done!',             icon: '✅' },
};

export default function CenterPanel() {
  const { session } = useStore();
  const { currentStep, productData, referenceProductData, designSystem, generatedContent, imageSlots } = session;
  const stepInfo = STEP_LABELS[currentStep] || STEP_LABELS.idle;

  const isIdle = currentStep === 'idle';

  return (
    <div className="panel panel-center">
      {/* Status Bar */}
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="panel-title">📊 Analysis & Plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{stepInfo.icon}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stepInfo.label}</span>
          {['scraping', 'analyzing', 'generating_content', 'generating_prompts', 'generating_images'].includes(currentStep) && (
            <div className="spinner" />
          )}
        </div>
      </div>

      <div className="panel-body">
        {isIdle && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.3 }}>📊</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Configure &amp; Generate
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto', lineHeight: 1.7 }}>
              Fill in your product details on the left panel and click <strong style={{ color: 'var(--indigo-light)' }}>Generate Creatives</strong> to begin.
            </p>
          </div>
        )}

        {/* Product Data */}
        {productData?.title && (
          <div className="content-section">
            <div className="content-section-header">📦 Your Product Data</div>
            <div className="content-section-body">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {productData.title}
              </div>
              {productData.category && (
                <span className="badge badge-cyan" style={{ marginBottom: 8 }}>{productData.category}</span>
              )}
              {productData.bullets?.length > 0 && (
                <ul style={{ paddingLeft: 14, marginTop: 8 }}>
                  {productData.bullets.slice(0, 5).map((b: string, i: number) => (
                    <li key={i} style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Reference Design System */}
        {designSystem && (
          <div className="content-section">
            <div className="content-section-header">🎨 Reference Design System</div>
            <div className="content-section-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  ['Layout', designSystem.layoutStyle],
                  ['Product Placement', designSystem.productPlacement],
                  ['Text Zone', designSystem.textPlacement],
                  ['Background', designSystem.backgroundType],
                  ['Lighting', designSystem.lightingStyle],
                  ['Typography', designSystem.typographyFeel],
                  ['Color Mood', designSystem.colorMood],
                  ['Tone', designSystem.overallTone],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 10px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generated Content Preview */}
        {generatedContent && (
          <div className="content-section">
            <div className="content-section-header">✍️ Generated Copy</div>
            <div className="content-section-body">
              <div style={{ marginBottom: 10 }}>
                <div className="form-label">Headlines</div>
                {generatedContent.headlines?.slice(0, 3).map((h: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, padding: '5px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, borderLeft: '2px solid var(--indigo)' }}>
                    {h}
                  </div>
                ))}
              </div>
              {generatedContent.tagline && (
                <div>
                  <div className="form-label">Tagline</div>
                  <div style={{ fontSize: 13, color: 'var(--text-accent)', fontStyle: 'italic' }}>"{generatedContent.tagline}"</div>
                </div>
              )}
              <div className="content-tag-list" style={{ marginTop: 10 }}>
                {generatedContent.featurePoints?.slice(0, 4).map((f: string, i: number) => (
                  <span key={i} className="content-tag">{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Image Plan / Prompts */}
        {imageSlots.length > 0 && (
          <div className="content-section">
            <div className="content-section-header">
              🖼️ Image Plan
              <span className="badge badge-indigo" style={{ marginLeft: 'auto' }}>{imageSlots.length} images</span>
            </div>
            <div className="content-section-body" style={{ padding: 0 }}>
              {imageSlots.map((slot, i) => (
                <PromptCard key={slot.id} slot={slot} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptCard({ slot, index }: { slot: any; index: number }) {
  const { setSelectedSlotId, setActivePanel } = useStore();
  const statusColors: Record<string, string> = {
    pending:    'var(--text-muted)',
    generating: 'var(--amber)',
    done:       'var(--emerald)',
    error:      'var(--rose)',
  };

  return (
    <div
      className="prompt-card"
      style={{ margin: '0 0 0 0', borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
      onClick={() => { setSelectedSlotId(slot.id); setActivePanel('right'); }}
    >
      <div className="prompt-card-header">
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', minWidth: 24 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="prompt-card-title">{slot.title}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusColors[slot.status],
            boxShadow: slot.status === 'generating' ? `0 0 8px ${statusColors[slot.status]}` : undefined,
          }} />
          <span style={{ fontSize: 10, color: statusColors[slot.status], fontWeight: 600, textTransform: 'capitalize' }}>
            {slot.status}
          </span>
        </div>
      </div>
      <div className="prompt-card-body" style={{ padding: '8px 14px 10px' }}>
        {slot.prompt}
      </div>
    </div>
  );
}
