'use client';
import { useStore } from '@/lib/store';
import axios from 'axios';
import type { ColorPalette } from '@/lib/types';

// ─── Colour preset palettes ───────────────────────────────────
const PALETTES: { name: string; colors: ColorPalette }[] = [
  { name: 'Royal Indigo',  colors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#06b6d4', background: '#ffffff', text: '#1a1a2e' } },
  { name: 'Forest Green',  colors: { primary: '#059669', secondary: '#10b981', accent: '#f59e0b', background: '#ffffff', text: '#064e3b' } },
  { name: 'Luxury Gold',   colors: { primary: '#b45309', secondary: '#d97706', accent: '#92400e', background: '#fffbeb', text: '#1c1108' } },
  { name: 'Rose Premium',  colors: { primary: '#e11d48', secondary: '#f43f5e', accent: '#fb923c', background: '#fff1f2', text: '#1a0a0d' } },
  { name: 'Ocean Blue',    colors: { primary: '#0284c7', secondary: '#0ea5e9', accent: '#06b6d4', background: '#f0f9ff', text: '#082f49' } },
  { name: 'Obsidian Dark', colors: { primary: '#1e1e2e', secondary: '#313244', accent: '#cba6f7', background: '#11111b', text: '#cdd6f4' } },
];

const TONES = ['premium', 'bold', 'minimal', 'luxury', 'technical'] as const;
const PLATFORMS = ['amazon', 'flipkart', 'generic'] as const;
const RATIOS = ['1:1', '4:5', '16:9', '9:16', '3:4'] as const;
const SIMILARITY = ['low', 'medium', 'high'] as const;

export default function LeftPanel() {
  const {
    session, setMode, setInput, setProductName,
    setProductData, setReferenceProductData, setDesignSystem,
    setGeneratedContent, setImageSlots, setColorPalette,
    setCurrentStep, setError, setActivePanel, setSelectedSlotId,
  } = useStore();

  const { inputs } = session;

  // ─── Main generation pipeline ─────────────────────────────────
  const handleGenerate = async () => {
    try {
      if (!inputs.productName.trim()) {
        alert('Please enter your product name.');
        return;
      }

      setError(undefined);

      // 1. Scrape / extract product data
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

      // Use manual content as fallback if no product data
      if (!productData) {
        productData = {
          title: inputs.productName,
          bullets: inputs.manualContent ? inputs.manualContent.split('\n').filter(Boolean) : [],
          features: [],
          specs: {},
          benefits: [],
          usageInstructions: [],
          imageUrls: [],
        };
        setProductData(productData);
      }

      // 2. Analyze reference design
      setCurrentStep('analyzing');
      let designSystem = session.designSystem;
      if (inputs.mode === 'reference' && referenceData) {
        const dsRes = await axios.post('/api/analyze', {
          referenceProductData: referenceData,
          imageUrls: referenceData.imageUrls || [],
        });
        if (dsRes.data.success) { designSystem = dsRes.data.data; setDesignSystem(dsRes.data.data); }
      }

      // 3. Generate content
      setCurrentStep('generating_content');
      const contentRes = await axios.post('/api/generate-content', {
        productData,
        tone: inputs.tone,
        platform: inputs.platform,
        language: inputs.language,
      });
      if (contentRes.data.success) setGeneratedContent(contentRes.data.data);

      // 4. Generate prompts
      setCurrentStep('generating_prompts');
      const promptsRes = await axios.post('/api/generate-prompts', {
        productData,
        designSystem,
        generatedContent: contentRes.data.data,
        colorPalette: inputs.colorTheme,
        aspectRatio: inputs.aspectRatio,
        tone: inputs.tone,
        backgroundStyle: inputs.backgroundStyle,
        imageCount: inputs.imageCount,
        similarityLevel: inputs.similarityLevel,
        productName: inputs.productName,
      });

      if (!promptsRes.data.success) throw new Error(promptsRes.data.error);
      const slots = promptsRes.data.data;
      setImageSlots(slots);

      // 5. Generate images one by one
      setCurrentStep('generating_images');
      setActivePanel('right');
      setSelectedSlotId(slots[0]?.id || null);

      for (const slot of slots) {
        const { updateImageSlot } = useStore.getState();
        updateImageSlot(slot.id, { status: 'generating' });

        try {
          const imgRes = await axios.post('/api/generate-image', {
            prompt: slot.prompt,
            aspectRatio: inputs.aspectRatio,
            slotId: slot.id,
          });
          if (imgRes.data.success) {
            updateImageSlot(slot.id, { status: 'done', imageUrl: imgRes.data.data.imageUrl });
            setSelectedSlotId(slot.id);
          } else {
            updateImageSlot(slot.id, { status: 'error', errorMessage: imgRes.data.error });
          }
        } catch (e: any) {
          updateImageSlot(slot.id, { status: 'error', errorMessage: e.message });
        }
      }

      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message || 'Generation failed');
      setCurrentStep('idle');
    }
  };

  const isGenerating = ['scraping', 'analyzing', 'generating_content', 'generating_prompts', 'generating_images'].includes(session.currentStep);

  return (
    <div className="panel panel-left">
      <div className="panel-header">
        <div className="panel-title">⚙️ Configuration</div>
      </div>

      <div className="panel-body">
        {/* MODE */}
        <div className="form-group">
          <div className="form-label">Mode</div>
          <div className="mode-toggle">
            <div
              id="mode-reference"
              className={`mode-card ${inputs.mode === 'reference' ? 'active' : ''}`}
              onClick={() => setMode('reference')}
            >
              <div className="mode-card-icon">🔗</div>
              <div className="mode-card-label">Reference Link</div>
              <div className="mode-card-desc">Clone a listing style</div>
            </div>
            <div
              id="mode-manual"
              className={`mode-card ${inputs.mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              <div className="mode-card-icon">✏️</div>
              <div className="mode-card-label">Manual Mode</div>
              <div className="mode-card-desc">Paste your content</div>
            </div>
          </div>
        </div>

        {/* PRODUCT NAME */}
        <div className="form-group">
          <label className="form-label">Product Name *</label>
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
          <label className="form-label">Your Product Link</label>
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
            <label className="form-label">Reference Listing Link</label>
            <input
              id="input-reference-link"
              className="form-input"
              placeholder="Paste a competitor/reference Amazon or Flipkart URL"
              value={inputs.referenceLink}
              onChange={e => setInput('referenceLink', e.target.value)}
            />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Manual Content</label>
            <textarea
              id="input-manual-content"
              className="form-input form-textarea"
              placeholder="Paste your product description, bullet points, features..."
              value={inputs.manualContent}
              onChange={e => setInput('manualContent', e.target.value)}
              rows={5}
            />
          </div>
        )}

        <div className="section-divider">
          <span className="section-divider-label">Settings</span>
        </div>

        {/* PLATFORM */}
        <div className="form-group">
          <label className="form-label">Platform</label>
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

        {/* IMAGE COUNT + ASPECT RATIO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Images</label>
            <select
              id="select-image-count"
              className="form-input form-select"
              value={inputs.imageCount}
              onChange={e => setInput('imageCount', Number(e.target.value))}
            >
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} images</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Ratio</label>
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

        {/* TONE */}
        <div className="form-group">
          <label className="form-label">Tone</label>
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
          <label className="form-label">Reference Similarity</label>
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
          <label className="form-label">Color Theme</label>
          <div className="color-row" style={{ marginBottom: 8 }}>
            {PALETTES.map((p) => (
              <div
                key={p.name}
                className={`color-swatch ${inputs.colorTheme?.primary === p.colors.primary ? 'active' : ''}`}
                style={{ background: p.colors.primary }}
                onClick={() => setInput('colorTheme', p.colors)}
                data-tooltip={p.name}
                id={`palette-${p.name.replace(/\s/g, '-').toLowerCase()}`}
              />
            ))}
            <div
              className={`color-swatch ${!inputs.colorTheme ? 'active' : ''}`}
              style={{ background: 'linear-gradient(135deg,#aaa,#555)', border: '1px dashed #555' }}
              onClick={() => setInput('colorTheme', undefined as any)}
              data-tooltip="Auto from product"
            />
          </div>
        </div>

        {/* LANGUAGE */}
        <div className="form-group">
          <label className="form-label">Language</label>
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
        <div style={{ marginTop: 8 }}>
          <button
            id="btn-generate"
            className="btn btn-generate"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Generating...
              </>
            ) : (
              <>✨ Generate Creatives</>
            )}
          </button>
        </div>

        {session.error && (
          <div className="toast toast-error" style={{ marginTop: 12, animation: 'none' }}>
            ⚠️ {session.error}
          </div>
        )}
      </div>
    </div>
  );
}
