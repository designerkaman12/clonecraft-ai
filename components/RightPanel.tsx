'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import axios from 'axios';
import JSZip from 'jszip';
import PromptEditor from './PromptEditor';
import { generateImageWithPolling } from '@/lib/imageGen';
import type { OverlayConfig } from '@/lib/types';
import {
  ImageIcon, Download, PenLine, RefreshCw, Package2,
  AlertTriangle, Loader2, CheckCircle2, Eye, Layers, LayersIcon
} from 'lucide-react';

export default function RightPanel() {
  const { session, selectedSlotId, setSelectedSlotId, updateImageSlot, isExporting, setIsExporting } = useStore();
  const { imageSlots, inputs, generatedContent, currentStep } = session;
  const selectedSlot = imageSlots.find(s => s.id === selectedSlotId) || null;

  const [showPromptEditor, setShowPromptEditor]       = useState(false);
  const [regenerateReason, setRegenerateReason]       = useState('');
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);
  const [showOverlay, setShowOverlay]                 = useState(true);
  const [overlayRendering, setOverlayRendering]       = useState(false);
  const compositing = useRef<Set<string>>(new Set());

  // ── Amazon-style Canvas Compositor ──────────────────────────────────────────
  // Matches the professional layout from sample images:
  // Bold BLACK headline + RED accent word, red underline, feature icons, product right
  const compositeImageWithOverlay = useCallback(async (
    imageUrl: string,
    overlay: OverlayConfig,
    slotType?: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SIZE = 1024;
      const canvas = document.createElement('canvas');
      canvas.width  = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // ── Background ──────────────────────────────────────────────────────────
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, SIZE, SIZE);

        const pos  = overlay.overlayPosition || 'top';
        const isHero     = slotType === 'hero';
        const isFeature  = slotType === 'feature' || slotType === 'how_to_use' || slotType === 'uses';
        const isCreative = slotType === 'creative_1' || slotType === 'creative_2';

        // ── Product image placement ──────────────────────────────────────────────
        if (isHero) {
          // Hero: product centered, slightly right, large
          const pSize = SIZE * 0.72;
          const pX    = SIZE * 0.28;
          const pY    = SIZE * 0.14;
          drawProductImage(ctx, img, pX, pY, pSize, pSize);
        } else if (isFeature || slotType === 'before_after') {
          // Feature: product on right half
          const pSize = SIZE * 0.54;
          const pX    = SIZE * 0.44;
          const pY    = SIZE * 0.20;
          drawProductImage(ctx, img, pX, pY, pSize, pSize);
        } else if (isCreative) {
          // Creative: full bleed with diagonal bottom stripe
          const pSize = SIZE * 0.65;
          const pX    = SIZE * 0.32;
          const pY    = SIZE * 0.08;
          drawProductImage(ctx, img, pX, pY, pSize, pSize);
          // Diagonal red-black stripe bottom
          ctx.save();
          ctx.fillStyle = '#111111';
          ctx.beginPath();
          ctx.moveTo(0, SIZE * 0.82);
          ctx.lineTo(SIZE * 0.55, SIZE * 0.74);
          ctx.lineTo(SIZE, SIZE * 0.74);
          ctx.lineTo(SIZE, SIZE);
          ctx.lineTo(0, SIZE);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#e02020';
          ctx.beginPath();
          ctx.moveTo(0, SIZE * 0.80);
          ctx.lineTo(SIZE * 0.55, SIZE * 0.72);
          ctx.lineTo(SIZE * 0.55, SIZE * 0.74);
          ctx.lineTo(0, SIZE * 0.82);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Default: product right
          const pSize = SIZE * 0.56;
          const pX    = SIZE * 0.42;
          const pY    = SIZE * 0.18;
          drawProductImage(ctx, img, pX, pY, pSize, pSize);
        }

        // ── Text area (left side for most layouts, top for hero) ────────────────
        const textStartX = isHero ? SIZE * 0.04 : SIZE * 0.04;
        const textStartY = isHero ? SIZE * 0.06 : SIZE * 0.08;
        const textMaxW   = isHero ? SIZE * 0.56 : SIZE * 0.44;
        let y = textStartY;
        const sc = SIZE / 1024;

        // ── Badge (if any) ───────────────────────────────────────────────────────
        if (overlay.badge) {
          const bFont = Math.round(16 * sc);
          ctx.font    = `800 ${bFont}px Arial, sans-serif`;
          const bPad  = Math.round(7 * sc);
          const bW    = ctx.measureText(overlay.badge).width + bPad * 3;
          const bH    = bFont + bPad * 1.6;
          ctx.fillStyle = '#e02020';
          ctx.beginPath();
          ctx.roundRect(textStartX, y, bW, bH, 4);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(overlay.badge, textStartX + bPad, y + bH - bPad * 0.7);
          y += bH + Math.round(12 * sc);
        }

        // ── Headline: split into BLACK + RED (second line/word accent) ──────────
        const headline = (overlay.headline || '').toUpperCase();
        const words    = headline.split(' ');
        // First ~half = black, second ~half = red (matches sample: SAVE SPACE & / STAY ORGANIZED)
        const splitIdx   = Math.ceil(words.length / 2);
        const line1Words = words.slice(0, splitIdx);
        const line2Words = words.slice(splitIdx);
        const hFont      = Math.round(72 * sc);
        ctx.font         = `900 ${hFont}px Arial Black, Arial, sans-serif`;
        ctx.shadowColor  = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur   = 4;

        // Line 1: Black
        ctx.fillStyle = '#111111';
        const line1 = line1Words.join(' ');
        ctx.fillText(line1, textStartX, y + hFont, textMaxW);
        y += hFont * 1.05;

        // Line 2: Red (accent)
        if (line2Words.length > 0) {
          ctx.fillStyle = '#e02020';
          const line2 = line2Words.join(' ');
          ctx.fillText(line2, textStartX, y + hFont, textMaxW);
          y += hFont * 1.0;
        }
        ctx.shadowBlur = 0;

        // ── Red underline separator ─────────────────────────────────────────────
        const lineW = Math.min(ctx.measureText(line1).width, textMaxW * 0.7);
        ctx.fillStyle = '#e02020';
        ctx.fillRect(textStartX, y + Math.round(8 * sc), lineW, Math.round(4 * sc));
        y += Math.round(28 * sc);

        // ── Subline ─────────────────────────────────────────────────────────────
        if (overlay.subline) {
          const sFont = Math.round(28 * sc);
          ctx.font    = `400 ${sFont}px Arial, sans-serif`;
          ctx.fillStyle = '#444444';
          ctx.fillText(overlay.subline.substring(0, 55), textStartX, y + sFont, textMaxW);
          y += sFont * 1.6;
        }

        // ── Feature bullets with red circle icons ───────────────────────────────
        if (overlay.bullets && overlay.bullets.length > 0) {
          const bFont    = Math.round(22 * sc);
          const iconR    = Math.round(22 * sc);
          const iconGap  = Math.round(14 * sc);
          const rowGap   = Math.round(18 * sc);
          y += Math.round(8 * sc);

          for (const bullet of overlay.bullets.slice(0, 3)) {
            const parts = bullet.split(':');
            const boldPart = parts[0].trim();
            const descPart = parts.length > 1 ? parts[1].trim() : '';

            // Red circle
            ctx.fillStyle = 'transparent';
            ctx.strokeStyle = '#e02020';
            ctx.lineWidth   = Math.round(2.5 * sc);
            ctx.beginPath();
            ctx.arc(textStartX + iconR, y + iconR, iconR, 0, Math.PI * 2);
            ctx.stroke();

            // Check inside circle
            ctx.font      = `700 ${Math.round(18 * sc)}px Arial, sans-serif`;
            ctx.fillStyle = '#e02020';
            ctx.textAlign = 'center';
            ctx.fillText('✓', textStartX + iconR, y + iconR + Math.round(7 * sc));
            ctx.textAlign = 'left';

            // Bold label
            ctx.font      = `800 ${bFont}px Arial, sans-serif`;
            ctx.fillStyle = '#111111';
            ctx.fillText(boldPart.substring(0, 30), textStartX + iconR * 2 + iconGap, y + bFont * 0.9);

            // Description
            if (descPart) {
              ctx.font      = `400 ${Math.round(17 * sc)}px Arial, sans-serif`;
              ctx.fillStyle = '#555555';
              ctx.fillText(descPart.substring(0, 40), textStartX + iconR * 2 + iconGap, y + bFont * 0.9 + Math.round(22 * sc));
            }

            y += iconR * 2 + rowGap + (descPart ? Math.round(16 * sc) : 0);
          }
        }

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });
  }, []);

  // Helper: draw product image centered/fitted in a box
  function drawProductImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  const handleDownloadWithOverlay = async () => {
    if (!selectedSlot?.imageUrl) return;
    setOverlayRendering(true);
    try {
      let dataUrl: string;
      if (selectedSlot.overlayConfig) {
        dataUrl = await compositeImageWithOverlay(
          selectedSlot.imageUrl,
          selectedSlot.overlayConfig,
          selectedSlot.type
        );
      } else {
        dataUrl = selectedSlot.imageUrl.startsWith('data:')
          ? selectedSlot.imageUrl
          : await (async () => {
              const res  = await fetch(selectedSlot.imageUrl!);
              const blob = await res.blob();
              return await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
            })();
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${selectedSlot.type}_${inputs.productName || 'image'}.png`;
      a.click();
    } finally {
      setOverlayRendering(false);
    }
  };

  // ── Auto-composite: runs Canvas when slot is done, updates preview ──────────
  useEffect(() => {
    const slotsToComposite = imageSlots.filter(
      (s) => s.status === 'done' && s.imageUrl && s.overlayConfig && !compositing.current.has(s.id)
    );
    slotsToComposite.forEach(async (slot) => {
      compositing.current.add(slot.id);
      try {
        const composited = await compositeImageWithOverlay(
          slot.imageUrl!,
          slot.overlayConfig!,
          slot.type
        );
        // Replace the raw imageUrl with the fully composited creative
        updateImageSlot(slot.id, { imageUrl: composited });
        console.log(`[RightPanel] Auto-composited slot=${slot.id}`);
      } catch (e) {
        console.warn(`[RightPanel] Composite failed for slot=${slot.id}:`, e);
        compositing.current.delete(slot.id);
      }
    });
  }, [imageSlots, compositeImageWithOverlay, updateImageSlot]);


  const handleRegenerate = async (slotId: string, customPrompt?: string) => {
    const slot = imageSlots.find(s => s.id === slotId);
    if (!slot) return;
    const promptToUse = customPrompt
      ? customPrompt + (regenerateReason ? `\n\nAdditional: ${regenerateReason}` : '')
      : slot.prompt;
    updateImageSlot(slotId, { status: 'generating', imageUrl: undefined });
    try {
      const imageUrl = await generateImageWithPolling(
        promptToUse,
        inputs.aspectRatio || '1:1',
        slotId
      );
      updateImageSlot(slotId, { status: 'done', imageUrl });
    } catch (e: any) {
      updateImageSlot(slotId, { status: 'error', errorMessage: e.message });
    }
    setShowRegenerateInput(false);
    setRegenerateReason('');
  };

  const handleDownloadSingle = handleDownloadWithOverlay;

  const handleExport = async () => {
    const doneSlots = imageSlots.filter(s => s.status === 'done' && s.imageUrl);
    if (doneSlots.length === 0) { alert('No images generated yet!'); return; }
    setIsExporting(true);
    try {
      const zip  = new JSZip();
      const name = (inputs.productName || 'CloneCraft_Export').replace(/[^a-z0-9]/gi, '_');
      const folder = zip.folder(name)!;
      for (let i = 0; i < doneSlots.length; i++) {
        const slot = doneSlots[i];
        try {
          // Always export the composited version (product + text overlay baked in)
          let dataUrl: string;
          if (slot.overlayConfig) {
            dataUrl = await compositeImageWithOverlay(slot.imageUrl!, slot.overlayConfig, slot.type);
          } else {
            dataUrl = slot.imageUrl!;
          }
          // Convert data URL to blob
          const arr = dataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)![1];
          const bstr = atob(arr[1]);
          const n = bstr.length;
          const u8arr = new Uint8Array(n);
          for (let j = 0; j < n; j++) u8arr[j] = bstr.charCodeAt(j);
          folder.file(`image_0${i + 1}_${slot.type}.png`, new Blob([u8arr], { type: mime }));
        } catch {}
      }
      const prompts: Record<string, string> = {};
      doneSlots.forEach((s, i) => { prompts[`image_0${i + 1}_${s.type}`] = s.prompt; });
      folder.file('prompts.json', JSON.stringify(prompts, null, 2));
      if (generatedContent) folder.file('content.json', JSON.stringify(generatedContent, null, 2));
      folder.file('metadata.json', JSON.stringify({
        productName: inputs.productName, platform: inputs.platform,
        tone: inputs.tone, aspectRatio: inputs.aspectRatio,
        imageCount: doneSlots.length, generatedAt: new Date().toISOString(),
        generatedBy: 'CloneCraft AI v1.0',
      }, null, 2));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${name}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const doneCount   = imageSlots.filter(s => s.status === 'done').length;
  const isGenerating = currentStep === 'generating_images';

  return (
    <>
      {showPromptEditor && selectedSlotId && (
        <PromptEditor slotId={selectedSlotId} onClose={() => setShowPromptEditor(false)} onRegenerate={handleRegenerate} />
      )}

      <div className="panel panel-right">
        {/* Panel header */}
        <div className="panel-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={13} style={{ color: 'var(--text-muted)' }} />
            <div className="panel-title">Preview</div>
          </div>
          {doneCount > 0 && (
            <span className="badge badge-emerald">
              <CheckCircle2 size={9} />
              {doneCount}/{imageSlots.length}
            </span>
          )}
        </div>

        {/* Image Preview Area */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>

          {/* No slot state */}
          {!selectedSlot && (
            <div style={{ textAlign: 'center', padding: 24, maxWidth: 220 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.07)', border: '1.5px solid rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <ImageIcon size={20} style={{ color: 'var(--indigo)', opacity: 0.5 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Preview Area</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Generated images appear here. Select any slot below to preview.
              </div>
            </div>
          )}

          {/* Generating spinner */}
          {selectedSlot?.status === 'generating' && (
            <div style={{ textAlign: 'center' }}>
              <Loader2 size={28} style={{ color: 'var(--indigo)', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Creating creative…</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, maxWidth: 180, lineHeight: 1.6 }}>
                Compositing your product image with Amazon-style layout.
              </div>
            </div>
          )}

          {/* Image with optional overlay preview */}
          {selectedSlot?.imageUrl && selectedSlot.status === 'done' && (
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.12), 0 0 0 1px var(--border)', margin: 16 }}>
              <img
                src={selectedSlot.imageUrl}
                alt={selectedSlot.title}
                id={`preview-image-${selectedSlot.id}`}
                style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 280px)', objectFit: 'contain' }}
              />

              {/* Amazon-style text overlay preview (CSS-based, matches Canvas output) */}
              {showOverlay && selectedSlot.overlayConfig && (() => {
                const ov = selectedSlot.overlayConfig!;
                const words = (ov.headline || '').toUpperCase().split(' ');
                const splitIdx = Math.ceil(words.length / 2);
                const line1 = words.slice(0, splitIdx).join(' ');
                const line2 = words.slice(splitIdx).join(' ');
                return (
                  <div style={{
                    position: 'absolute', inset: 0, padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                    pointerEvents: 'none', background: 'transparent',
                  }}>
                    {ov.badge && (
                      <span style={{
                        alignSelf: 'flex-start', background: '#e02020', color: '#fff',
                        fontSize: 8, fontWeight: 900, padding: '2px 7px',
                        borderRadius: 3, marginBottom: 6, letterSpacing: 0.8,
                      }}>{ov.badge}</span>
                    )}
                    {/* Headline: black + red */}
                    <div style={{ lineHeight: 1.1, marginBottom: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#111', textTransform: 'uppercase', letterSpacing: -0.3 }}>{line1}</div>
                      {line2 && <div style={{ fontSize: 16, fontWeight: 900, color: '#e02020', textTransform: 'uppercase', letterSpacing: -0.3 }}>{line2}</div>}
                    </div>
                    {/* Red underline */}
                    <div style={{ width: 40, height: 2.5, background: '#e02020', marginBottom: 6 }} />
                    {ov.subline && (
                      <div style={{ fontSize: 9, color: '#444', marginBottom: 8 }}>{ov.subline}</div>
                    )}
                    {/* Feature bullets with red circle icons */}
                    {ov.bullets && ov.bullets.slice(0, 3).map((b, i) => {
                      const parts = b.split(':');
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 5 }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #e02020',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: 1,
                          }}>
                            <span style={{ fontSize: 7, color: '#e02020', fontWeight: 900 }}>✓</span>
                          </div>
                          <div>
                            <div style={{ fontSize: 8.5, fontWeight: 800, color: '#111' }}>{parts[0]}</div>
                            {parts[1] && <div style={{ fontSize: 7.5, color: '#555', marginTop: 1 }}>{parts[1].trim()}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Floating action buttons */}
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 5 }}>
                {/* Overlay toggle */}
                {selectedSlot.overlayConfig && (
                  <button
                    className="btn btn-sm"
                    onClick={() => setShowOverlay(v => !v)}
                    data-tooltip={showOverlay ? 'Hide overlay' : 'Show overlay'}
                    style={{
                      background: showOverlay ? 'rgba(99,102,241,0.92)' : 'rgba(255,255,255,0.92)',
                      border: '1px solid var(--border)', backdropFilter: 'blur(6px)',
                      color: showOverlay ? '#fff' : 'var(--text-primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  >
                    <Layers size={13} />
                  </button>
                )}
                <button
                  className="btn btn-sm"
                  onClick={handleDownloadSingle}
                  disabled={overlayRendering}
                  data-tooltip="Download"
                  style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)', backdropFilter: 'blur(6px)', color: 'var(--text-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                >
                  {overlayRendering ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setShowPromptEditor(true)}
                  data-tooltip="Edit prompt"
                  style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)', backdropFilter: 'blur(6px)', color: 'var(--text-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                >
                  <PenLine size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {selectedSlot?.status === 'error' && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <AlertTriangle size={28} style={{ color: 'var(--rose)', margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rose)' }}>Generation Failed</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, maxWidth: 200, lineHeight: 1.6 }}>
                {selectedSlot.errorMessage}
              </div>
              <button className="btn btn-danger btn-sm" style={{ marginTop: 12 }} onClick={() => handleRegenerate(selectedSlot.id)}>
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}
        </div>

        {/* Slot info bar */}
        {selectedSlot && (
          <div style={{ padding: '8px 12px', background: 'var(--bg-raised)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSlot.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                Slot {(imageSlots.findIndex(s => s.id === selectedSlot.id) + 1)} · {inputs.aspectRatio}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPromptEditor(true)} style={{ fontSize: 11 }}>
              <PenLine size={11} /> Edit Prompt
            </button>
          </div>
        )}

        {/* Thumbnail strip */}
        {imageSlots.length > 0 && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
              {imageSlots.map((slot, i) => {
                const isSelected = selectedSlotId === slot.id;
                return (
                  <div
                    key={slot.id}
                    id={`slot-thumb-${slot.id}`}
                    onClick={() => setSelectedSlotId(slot.id)}
                    style={{
                      width: 48, height: 48, flexShrink: 0,
                      borderRadius: 8,
                      border: `2px solid ${isSelected ? 'var(--indigo)' : 'var(--border)'}`,
                      overflow: 'hidden', cursor: 'pointer', position: 'relative',
                      background: 'var(--bg-surface)',
                      transition: 'all 0.18s',
                      transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                      boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                    }}
                  >
                    {slot.imageUrl ? (
                      <img src={slot.imageUrl} alt={slot.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, position: 'relative', background: 'var(--bg-card)' }}>
                        {slot.status === 'generating' && <div className="slot-shimmer" />}
                        <span style={{ position: 'relative', zIndex: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                      </div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 2, right: 2,
                      width: 6, height: 6, borderRadius: '50%',
                      background: slot.status === 'done' ? 'var(--emerald)' : slot.status === 'error' ? 'var(--rose)' : slot.status === 'generating' ? 'var(--amber)' : '#d1d5db',
                      boxShadow: slot.status === 'generating' ? '0 0 5px var(--amber)' : undefined,
                    }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7, background: 'var(--bg-surface)' }}>
          {/* Per-slot actions */}
          {selectedSlot && (selectedSlot.status === 'done' || selectedSlot.status === 'error') && (
            <>
              {showRegenerateInput ? (
                <div>
                  <input
                    className="form-input"
                    placeholder="Change instructions (optional)…"
                    value={regenerateReason}
                    onChange={e => setRegenerateReason(e.target.value)}
                    style={{ marginBottom: 6 }}
                    onKeyDown={e => e.key === 'Enter' && handleRegenerate(selectedSlot.id)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button id="btn-confirm-regenerate" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleRegenerate(selectedSlot.id)}>
                      <RefreshCw size={12} /> Regenerate
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowRegenerateInput(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button id="btn-regenerate" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setShowRegenerateInput(true)}>
                    <RefreshCw size={12} /> Regenerate
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowPromptEditor(true)} data-tooltip="Edit prompt">
                    <PenLine size={12} />
                  </button>
                  {selectedSlot.status === 'done' && (
                    <button className="btn btn-secondary btn-sm" onClick={handleDownloadSingle} data-tooltip="Download">
                      <Download size={12} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Export ZIP */}
          {doneCount > 0 && (
            <button id="btn-export-zip" className="btn btn-primary btn-full" onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Packaging…</>
              ) : (
                <><Package2 size={14} /> Export All ({doneCount} image{doneCount !== 1 ? 's' : ''})</>
              )}
            </button>
          )}

          {imageSlots.length === 0 && currentStep === 'idle' && (
            <div style={{ textAlign: 'center', padding: '4px 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Configure and generate to see your creatives here
            </div>
          )}
        </div>
      </div>
    </>
  );
}
