'use client';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      icon: '🎯',
      title: 'Style Cloning',
      desc: 'Replicate any reference listing\'s layout, hierarchy, and composition — not the content.',
    },
    {
      icon: '🤖',
      title: 'AI-Powered Copy',
      desc: 'GPT generates unique headlines, features, and CTAs tailored to your product.',
    },
    {
      icon: '🖼️',
      title: '7-Image Set',
      desc: 'Hero, Features, How-To-Use, Before/After — complete Amazon/Flipkart image sequence.',
    },
    {
      icon: '🎨',
      title: 'Color Intelligence',
      desc: 'Auto-extracts brand colors from your product or lets you define your own palette.',
    },
    {
      icon: '✂️',
      title: 'BG Removal',
      desc: 'Automatic background removal and relighting via Recraft AI.',
    },
    {
      icon: '📦',
      title: 'ZIP Export',
      desc: 'Download all images, prompts.json, and metadata in one organized package.',
    },
  ];

  return (
    <div className="landing-page">
      <div className="landing-bg" />

      {/* Hero */}
      <div className="landing-hero">
        <div className="landing-eyebrow">
          <span>⚡</span>
          <span>Powered by GPT-Image-1 + kie.ai</span>
        </div>

        <h1 className="landing-title">
          Clone Any Listing. <br />
          <span className="gradient-text">Make It Yours.</span>
        </h1>

        <p className="landing-subtitle">
          CloneCraft AI analyzes any Amazon or Flipkart reference listing's design system and 
          regenerates a complete 7-image creative set — adapted to your product, content, and brand.
        </p>

        <div className="landing-actions">
          <button
            id="cta-start-building"
            className="btn btn-generate"
            style={{ width: 'auto', padding: '14px 36px', fontSize: '16px' }}
            onClick={() => router.push('/workspace')}
          >
            🚀 Start Building
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => router.push('/workspace')}
          >
            👁️ See Demo
          </button>
        </div>
        <p className="landing-cta-text">No credit card · Needs kie.ai API key</p>
      </div>

      {/* Features */}
      <div className="landing-features">
        {features.map((f, i) => (
          <div key={i} className="feature-pill">
            <div className="feature-pill-icon">{f.icon}</div>
            <div className="feature-pill-title">{f.title}</div>
            <div className="feature-pill-desc">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Workflow steps */}
      <div style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          How it works
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            ['1', 'Paste Links', 'Your product + reference'],
            ['2', 'AI Analyzes', 'Style, layout, content'],
            ['3', 'Generate', '7 listing images'],
            ['4', 'Export', 'ZIP with all assets'],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 24, fontWeight: 900, background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>
                {num}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
