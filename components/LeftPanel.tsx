'use client';
import { useStore } from '@/lib/store';
import axios from 'axios';
import type { ColorPalette, ImageSlot } from '@/lib/types';
import { generateImageWithPolling } from '@/lib/imageGen';
import {
  Link2, PencilLine, Package, Settings2, Palette,
  Sparkles, Loader2, AlertCircle, Globe,
  Ratio, AlignLeft, Languages, ImageIcon
} from 'lucide-react';

const PALETTES: { name: string; colors: ColorPalette; hex: string }[] = [
  { name: 'Indigo',  hex: '#6366f1', colors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#06b6d4', background: '#ffffff', text: '#1a1a2e' } },
  { name: 'Green',   hex: '#059669', colors: { primary: '#059669', secondary: '#10b981', accent: '#f59e0b', background: '#ffffff', text: '#064e3b' } },
  { name: 'Gold',    hex: '#d97706', colors: { primary: '#b45309', secondary: '#d97706', accent: '#92400e', background: '#fffbeb', text: '#1c1108' } },
  { name: 'Rose',    hex: '#e11d48', colors: { primary: '#e11d48', secondary: '#f43f5e', accent: '#fb923c', background: '#fff1f2', text: '#1a0a0d' } },
  { name: 'Blue',    hex: '#0284c7', colors: { primary: '#0284c7', secondary: '#0ea5e9', accent: '#06b6d4', background: '#f0f9ff', text: '#082f49' } },
  { name: 'Dark',    hex: '#374151', colors: { primary: '#1e1e2e', secondary: '#313244', accent: '#cba6f7', background: '#11111b', text: '#cdd6f4' } },
];

const TONES      = ['premium', 'bold', 'minimal', 'luxury', 'technical'] as const;
const PLATFORMS  = ['amazon', 'flipkart', 'generic'] as const;
const RATIOS     = ['1:1', '4:5', '16:9', '9:16', '3:4'] as const;
const SIMILARITY = ['low', 'medium', 'high'] as const;

export default function LeftPanel() {
  const {
    session, setMode, setInput, setProductName,
    setProductData, setReferenceProductData, setDesignSystem,
    setGeneratedContent, setImageSlots, setColorPalette,
    setCurrentStep, setError, setActivePanel, setSelectedSlotId,
  } = useStore();

  const { inputs } = session;

  const handleGenerate = async () => {
    try {
      if (!inputs.productName.trim()) {
        alert('Please enter your product name.');
        return;
      }
      setError(undefined);
      setCurrentStep('scraping');
      setActivePanel('center');

      let productData = session.productData;
      let referenceData = session.referenceProductData;

      if (inputs.ownProductLink) {
        const res = await axios.post('/api/scrape', { url: inputs.ownProductLink, type: 'own' });
        if (res.data.success) { productData = res.data.data; setProductData(res.data.data); }
      }

      if (inputs.mode === 'reference' && inputs.referenceLink) {
        const refRes = await axios.post('/api/scrape', { url: inputs.referenceLink, type: 'reference' });
        if (refRes.data.success) { referenceData = refRes.data.data; setReferenceProductData(refRes.data.data); }
      }

      if (!productData) {
        productData = {
          title: inputs.productName,
          bullets: inputs.manualContent ? inputs.manualContent.split('\n').filter(Boolean) : [],
          features: [], specs: {}, benefits: [], usageInstructions: [], imageUrls: [],
        };
        setProductData(productData);
      }

      setCurrentStep('analyzing');
      let designSystem = session.designSystem;
      if (inputs.mode === 'reference' && referenceData) {
        const dsRes = await axios.post('/api/analyze', {
          referenceProductData: referenceData,
          imageUrls: referenceData.imageUrls || [],
        });
        if (dsRes.data.success) { designSystem = dsRes.data.data; setDesignSystem(dsRes.data.data); }
      }

      setCurrentStep('generating_content');
      const contentRes = await axios.post('/api/generate-content', {
        productData, tone: inputs.tone, platform: inputs.platform, language: inputs.language,
      });
      if (contentRes.data.success) setGeneratedContent(contentRes.data.data);

      setCurrentStep('generating_prompts');
      const promptsRes = await axios.post('/api/generate-prompts', {
        productData, designSystem, generatedContent: contentRes.data.data,
        colorPalette: inputs.colorTheme, aspectRatio: inputs.aspectRatio,
        tone: inputs.tone, backgroundStyle: inputs.backgroundStyle,
        imageCount: inputs.imageCount, similarityLevel: inputs.similarityLevel,
        productName: inputs.productName,
      });

      if (!promptsRes.data.success) throw new Error(promptsRes.data.error);
      const slots = promptsRes.data.data;
      setImageSlots(slots);

      setCurrentStep('generating_images');
      setActivePanel('right');
      setSelectedSlotId(slots[0]?.id || null);

      // Mark all as generating immediately (parallel)
      slots.forEach((slot: ImageSlot) => {
        useStore.getState().updateImageSlot(slot.id, { status: 'generating' });
      });

      // Generate all images in parallel — much faster than sequential
      await Promise.allSettled(
        slots.map(async (slot: ImageSlot) => {
          try {
            const imageUrl = await generateImageWithPolling(
              slot.prompt,
              inputs.aspectRatio || '1:1',
              slot.id
            );
            useStore.getState().updateImageSlot(slot.id, { status: 'done', imageUrl });
            // Auto-select first completed image
            const current = useStore.getState().selectedSlotId;
            if (!current || useStore.getState().session.imageSlots.find(s => s.id === current)?.status !== 'done') {
              useStore.getState().setSelectedSlotId(slot.id);
            }
          } catch (e: any) {
            useStore.getState().updateImageSlot(slot.id, { status: 'error', errorMessage: e.message });
          }
        })
      );
      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message || 'Generation failed');
      setCurrentStep('idle');
    }
  };

  const isGenerating = ['scraping', 'analyzing', 'generating_content', 'generating_prompts', 'generating_images'].includes(session.currentStep);

  return (
    <div className="panel panel-left">
      {/* Header */}
      <div className="panel-header">
        <Settings2 size={13} style={{ color: 'var(--text-muted)' }} />
        <div className="panel-title">Configuration</div>
      </div>

      <div className="panel-body">

        {/* MODE */}
        <div className="form-group">
          <div className="form-label">Input Mode</div>
          <div className="mode-toggle">
            <div
              id="mode-reference"
              className={`mode-card ${inputs.mode === 'reference' ? 'active' : ''}`}
              onClick={() => setMode('reference')}
            >
              <div className="mode-card-icon"><Link2 size={18} strokeWidth={1.8} /></div>
              <div className="mode-card-label">Link Mode</div>
              <div className="mode-card-desc">Clone a listing</div>
            </div>
            <div
              id="mode-manual"
              className={`mode-card ${inputs.mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              <div className="mode-card-icon"><PencilLine size={18} strokeWidth={1.8} /></div>
              <div className="mode-card-label">Manual</div>
              <div className="mode-card-desc">Paste content</div>
            </div>
          </div>
        </div>

        {/* PRODUCT NAME */}
        <div className="form-group">
          <label className="form-label">
            <Package size={10} style={{ display: 'inline', marginRight: 4 }} />
            Product Name *
          </label>
          <input
            id="input-product-name"
            className="form-input"
            placeholder="e.g. Vitamin C Serum 30ml"
            value={inputs.productName}
            onChange={e => setProductName(e.target.value)}
          />
        </div>

        {/* OWN PRODUCT LINK */}
        <div className="form-group">
          <label className="form-label">
            <Link2 size={10} style={{ display: 'inline', marginRight: 4 }} />
            Your Product Link
          </label>
          <input
            id="input-own-link"
            className="form-input"
            placeholder="amazon.in/dp/... or flipkart.com/..."
            value={inputs.ownProductLink}
            onChange={e => setInput('ownProductLink', e.target.value)}
          />
        </div>

        {/* REFERENCE / MANUAL */}
        {inputs.mode === 'reference' ? (
          <div className="form-group">
            <label className="form-label">
              <Link2 size={10} style={{ display: 'inline', marginRight: 4 }} />
              Reference Listing Link
            </label>
            <input
              id="input-reference-link"
              className="form-input"
              placeholder="Competitor/reference Amazon or Flipkart URL"
              value={inputs.referenceLink}
              onChange={e => setInput('referenceLink', e.target.value)}
            />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">
              <AlignLeft size={10} style={{ display: 'inline', marginRight: 4 }} />
              Product Content
            </label>
            <textarea
              id="input-manual-content"
              className="form-input form-textarea"
              placeholder="Paste your product description, bullet points, features..."
              value={inputs.manualContent}
              onChange={e => setInput('manualContent', e.target.value)}
              rows={4}
            />
          </div>
        )}

        {/* SETTINGS DIVIDER */}
        <div className="section-divider">
          <span className="section-divider-label">Settings</span>
        </div>

        {/* PLATFORM + RATIO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">
              <Globe size={10} style={{ display: 'inline', marginRight: 4 }} />
              Platform
            </label>
            <select
              id="select-platform"
              className="form-input form-select"
              value={inputs.platform}
              onChange={e => setInput('platform', e.target.value as any)}
            >
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              <Ratio size={10} style={{ display: 'inline', marginRight: 4 }} />
              Ratio
            </label>
            <select
              id="select-aspect-ratio"
              className="form-input form-select"
              value={inputs.aspectRatio}
              onChange={e => setInput('aspectRatio', e.target.value as any)}
            >
              {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* IMAGE COUNT */}
        <div className="form-group">
          <label className="form-label">
            <ImageIcon size={10} style={{ display: 'inline', marginRight: 4 }} />
            Images to Generate
          </label>
          <select
            id="select-image-count"
            className="form-input form-select"
            value={inputs.imageCount}
            onChange={e => setInput('imageCount', Number(e.target.value))}
          >
            {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} image{n > 1 ? 's' : ''}</option>)}
          </select>
        </div>

        {/* TONE */}
        <div className="form-group">
          <label className="form-label">Creative Tone</label>
          <div className="slider-row">
            {TONES.map(t => (
              <button
                key={t}
                id={`tone-${t}`}
                className={`slider-option ${inputs.tone === t ? 'active' : ''}`}
                onClick={() => setInput('tone', t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* SIMILARITY */}
        <div className="form-group">
          <label className="form-label">Style Similarity</label>
          <div className="slider-row">
            {SIMILARITY.map(s => (
              <button
                key={s}
                id={`similarity-${s}`}
                className={`slider-option ${inputs.similarityLevel === s ? 'active' : ''}`}
                onClick={() => setInput('similarityLevel', s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* BACKGROUND */}
        <div className="form-group">
          <label className="form-label">Background Style</label>
          <select
            id="select-background"
            className="form-input form-select"
            value={inputs.backgroundStyle}
            onChange={e => setInput('backgroundStyle', e.target.value)}
          >
            {['clean white', 'gradient', 'lifestyle', 'textured', 'black', 'pastel', 'natural'].map(b => (
              <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* COLOR PALETTE */}
        <div className="form-group">
          <label className="form-label">
            <Palette size={10} style={{ display: 'inline', marginRight: 4 }} />
            Color Theme
          </label>
          <div className="color-row">
            {PALETTES.map(p => (
              <div
                key={p.name}
                className={`color-swatch ${inputs.colorTheme?.primary === p.colors.primary ? 'active' : ''}`}
                style={{ background: p.hex }}
                onClick={() => setInput('colorTheme', p.colors)}
                data-tooltip={p.name}
                id={`palette-${p.name.toLowerCase()}`}
              />
            ))}
            <div
              className={`color-swatch ${!inputs.colorTheme ? 'active' : ''}`}
              style={{ background: 'linear-gradient(135deg, #94a3b8, #475569)' }}
              onClick={() => setInput('colorTheme', undefined as any)}
              data-tooltip="Auto-detect"
            />
          </div>
          {inputs.colorTheme && (
            <div style={{ fontSize: 10, color: 'var(--indigo)', marginTop: 4, fontWeight: 600 }}>
              {PALETTES.find(p => p.colors.primary === inputs.colorTheme?.primary)?.name ?? 'Custom'}
            </div>
          )}
        </div>

        {/* LANGUAGE */}
        <div className="form-group">
          <label className="form-label">
            <Languages size={10} style={{ display: 'inline', marginRight: 4 }} />
            Language
          </label>
          <select
            id="select-language"
            className="form-input form-select"
            value={inputs.language}
            onChange={e => setInput('language', e.target.value)}
          >
            {['English', 'Hindi', 'Hinglish', 'Tamil', 'Telugu', 'Bengali', 'Marathi'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* GENERATE BUTTON */}
        <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            id="btn-generate"
            className="btn btn-generate"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Creatives
              </>
            )}
          </button>
        </div>

        {session.error && (
          <div
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              marginTop: 12, padding: '10px 12px',
              background: '#fff1f2', border: '1px solid #fda4af',
              borderRadius: 'var(--radius-md)', fontSize: 12,
              color: '#9f1239', lineHeight: 1.5,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {session.error}
          </div>
        )}
      </div>
    </div>
  );
}
