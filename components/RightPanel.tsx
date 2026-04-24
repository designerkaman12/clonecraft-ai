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
  const [compositedUrls, setCompositedUrls]           = useState<Record<string, string>>({});
  const compositing = useRef<Set<string>>(new Set());

  // ── Amazon-style Canvas Compositor ──────────────────────────────────────────
  // ── Amazon-style Canvas Compositor ──────────────────────────────────────────
  // Architecture:
  //   1. Draw background (white/gradient)
  //   2. Drop product image with multiply blend → removes white bg
  //   3. Add product drop shadow for natural composite look
  //   4. Render text in SAFE ZONE that never overlaps product zone
  //   5. All text is rendered by Canvas (not AI) → no distortion
  const compositeImageWithOverlay = useCallback(async (
    imageUrl: string,
    overlay: OverlayConfig,
    slotType?: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SIZE = 1024;
      const MARGIN = Math.round(SIZE * 0.08); // 8% safe margin from all edges
      const canvas = document.createElement('canvas');
      canvas.width  = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // ── 1. Background ────────────────────────────────────────────────────────
        // Clean white base — Amazon standard
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, SIZE, SIZE);

        // Subtle light gray vignette in corners for premium feel
        const vigGrd = ctx.createRadialGradient(SIZE/2, SIZE/2, SIZE*0.35, SIZE/2, SIZE/2, SIZE*0.72);
        vigGrd.addColorStop(0, 'rgba(255,255,255,0)');
        vigGrd.addColorStop(1, 'rgba(235,235,240,0.4)');
        ctx.fillStyle = vigGrd;
        ctx.fillRect(0, 0, SIZE, SIZE);

        // ── 2. Layout zones (text zone LEFT, product zone RIGHT for most) ────────
        // Text safe zone:  x: MARGIN → textZoneEnd, y: MARGIN → SIZE-MARGIN
        // Product zone:    x: productX → SIZE-MARGIN, y: productY → SIZE-MARGIN
        // These NEVER overlap.
        const isHero     = slotType === 'hero';
        const isFeature  = slotType === 'feature' || slotType === 'uses';
        const isHowTo    = slotType === 'how_to_use';
        const isCreative = slotType === 'creative_1' || slotType === 'creative_2';
        const isBefore   = slotType === 'before_after';

        // Determine product placement & text zone for each layout
        let pX: number, pY: number, pW: number, pH: number;
        let textZoneX: number, textZoneY: number, textZoneW: number, textZoneH: number;

        if (isHero) {
          // Hero: product fills right 65%, text top-left — product DOMINANT
          pW = SIZE * 0.65; pH = SIZE * 0.65;
          pX = SIZE - pW - MARGIN * 0.3; pY = (SIZE - pH) / 2;
          textZoneX = MARGIN; textZoneY = MARGIN;
          textZoneW = SIZE * 0.40; textZoneH = SIZE - MARGIN * 2;
        } else if (isFeature || isHowTo) {
          // Feature: product right 56%, text left 36% — product clearly visible
          pW = SIZE * 0.56; pH = SIZE * 0.56;
          pX = SIZE * 0.42; pY = (SIZE - pH) / 2;
          textZoneX = MARGIN; textZoneY = MARGIN;
          textZoneW = SIZE * 0.36; textZoneH = SIZE - MARGIN * 2;
        } else if (isCreative) {
          // Creative: product center-right large, text top-left
          pW = SIZE * 0.62; pH = SIZE * 0.62;
          pX = SIZE * 0.35; pY = (SIZE - pH) / 2;
          textZoneX = MARGIN; textZoneY = MARGIN;
          textZoneW = SIZE * 0.36; textZoneH = SIZE - MARGIN * 2;
        } else if (isBefore) {
          // Before/After: product center-bottom, large, text top only
          pW = SIZE * 0.62; pH = SIZE * 0.50;
          pX = (SIZE - pW) / 2; pY = SIZE * 0.38;
          textZoneX = MARGIN; textZoneY = MARGIN;
          textZoneW = SIZE - MARGIN * 2; textZoneH = SIZE * 0.34;
        } else {
          // Default: product right large, text left
          pW = SIZE * 0.54; pH = SIZE * 0.54;
          pX = SIZE * 0.44; pY = (SIZE - pH) / 2;
          textZoneX = MARGIN; textZoneY = MARGIN;
          textZoneW = SIZE * 0.38; textZoneH = SIZE - MARGIN * 2;
        }

        // Creative layout — subtle bottom accent line only (no random shapes)
        if (isCreative) {
          ctx.fillStyle = '#e02020';
          ctx.fillRect(0, SIZE - 5, SIZE, 5);
        }

        // ── 3. Product drop shadow (drawn BEFORE product) ─────────────────────────
        // Soft elliptical shadow beneath product
        const shadowGrd = ctx.createRadialGradient(
          pX + pW/2, pY + pH * 0.92,
          0,
          pX + pW/2, pY + pH * 0.92,
          pW * 0.38
        );
        shadowGrd.addColorStop(0, 'rgba(0,0,0,0.18)');
        shadowGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrd;
        ctx.beginPath();
        ctx.ellipse(pX + pW/2, pY + pH * 0.94, pW * 0.38, pH * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── 4. Product image — multiply blend removes white background ────────────
        // multiply blend: white (255,255,255) × canvas_color = canvas_color (invisible)
        // Non-white product pixels are preserved exactly as uploaded
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        drawProductFitted(ctx, img, pX, pY, pW, pH);
        ctx.restore();

        // ── 5. Text rendering in SAFE ZONE (never overlaps product) ──────────────
        const sc = SIZE / 1024;
        let ty = textZoneY;
        const tx = textZoneX;
        const tmW = textZoneW;
        const maxY = textZoneY + textZoneH;

        // ── Badge ─────────────────────────────────────────────────────────────────
        if (overlay.badge && ty + 30 * sc < maxY) {
          const bFont = Math.round(15 * sc);
          ctx.font    = `800 ${bFont}px Arial, sans-serif`;
          const bPad  = Math.round(6 * sc);
          const bW    = ctx.measureText(overlay.badge).width + bPad * 3;
          const bH    = bFont + bPad * 1.8;
          ctx.fillStyle = '#e02020';
          ctx.beginPath();
          ctx.roundRect(tx, ty, bW, bH, Math.round(3 * sc));
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(overlay.badge, tx + bPad, ty + bH - bPad * 0.6);
          ty += bH + Math.round(14 * sc);
        }

        // ── Headline: Line 1 BLACK, Line 2 RED ───────────────────────────────────
        const headline = (overlay.headline || '').toUpperCase();
        const words = headline.split(' ');
        const splitIdx = Math.ceil(words.length / 2);
        const line1 = words.slice(0, splitIdx).join(' ');
        const line2 = words.slice(splitIdx).join(' ');
        const hFont = Math.round(isHero ? 52 * sc : 46 * sc);

        if (ty + hFont < maxY) {
          ctx.font        = `900 ${hFont}px Arial Black, Arial, sans-serif`;
          ctx.shadowColor = 'rgba(0,0,0,0.06)';
          ctx.shadowBlur  = 3;
          ctx.fillStyle   = '#111111';
          const wrappedLine1 = wrapText(ctx, line1, tmW);
          for (const wl of wrappedLine1) {
            if (ty + hFont > maxY) break;
            ctx.fillText(wl, tx, ty + hFont);
            ty += hFont * 1.1;
          }
          if (line2 && ty + hFont < maxY) {
            ctx.fillStyle = '#e02020';
            const wrappedLine2 = wrapText(ctx, line2, tmW);
            for (const wl of wrappedLine2) {
              if (ty + hFont > maxY) break;
              ctx.fillText(wl, tx, ty + hFont);
              ty += hFont * 1.1;
            }
          }
          ctx.shadowBlur = 0;
        }

        // ── Red underline ─────────────────────────────────────────────────────────
        if (ty + 12 * sc < maxY) {
          ctx.font = `900 ${Math.round(isHero ? 52 * sc : 46 * sc)}px Arial Black, Arial, sans-serif`;
          const underW = Math.min(ctx.measureText(line1).width, tmW * 0.80);
          ctx.fillStyle = '#e02020';
          ctx.fillRect(tx, ty + Math.round(6 * sc), underW, Math.round(4 * sc));
          ty += Math.round(22 * sc);
        }

        // ── Subline ───────────────────────────────────────────────────────────────
        if (overlay.subline && ty + 30 * sc < maxY) {
          const sFont = Math.round(24 * sc);
          ctx.font      = `400 ${sFont}px Arial, sans-serif`;
          ctx.fillStyle = '#444444';
          ctx.fillText(overlay.subline.substring(0, 60), tx, ty + sFont, tmW);
          ty += sFont * 1.7;
        }

        // ── Feature bullets with red circle icons ─────────────────────────────────
        if (overlay.bullets && overlay.bullets.length > 0) {
          const bFont  = Math.round(20 * sc);
          const iconR  = Math.round(20 * sc);
          const iconGap= Math.round(12 * sc);
          ty += Math.round(10 * sc);

          for (const bullet of overlay.bullets.slice(0, 3)) {
            if (ty + iconR * 2 > maxY) break;
            const parts    = bullet.split(':');
            const boldPart = parts[0].trim().substring(0, 28);
            const descPart = (parts[1] || '').trim().substring(0, 38);

            // Red circle outline
            ctx.strokeStyle = '#e02020';
            ctx.lineWidth   = Math.round(2 * sc);
            ctx.beginPath();
            ctx.arc(tx + iconR, ty + iconR, iconR, 0, Math.PI * 2);
            ctx.stroke();

            // Checkmark
            ctx.font      = `700 ${Math.round(16 * sc)}px Arial, sans-serif`;
            ctx.fillStyle = '#e02020';
            ctx.textAlign = 'center';
            ctx.fillText('✓', tx + iconR, ty + iconR + Math.round(6 * sc));
            ctx.textAlign = 'left';

            // Bold feature label
            ctx.font      = `800 ${bFont}px Arial, sans-serif`;
            ctx.fillStyle = '#111111';
            ctx.fillText(boldPart, tx + iconR * 2 + iconGap, ty + bFont * 0.92);

            // Description
            if (descPart) {
              ctx.font      = `400 ${Math.round(15 * sc)}px Arial, sans-serif`;
              ctx.fillStyle = '#555555';
              ctx.fillText(descPart, tx + iconR * 2 + iconGap, ty + bFont * 0.92 + Math.round(20 * sc));
            }

            ty += iconR * 2 + Math.round(14 * sc) + (descPart ? Math.round(12 * sc) : 0);
          }
        }

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });
  }, []);


  // Helper: draw product image centered/fitted in a box (legacy)
  function drawProductImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  // Helper: draw product fitted (used with multiply blend for bg removal)
  function drawProductFitted(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  // Helper: word-wrap text to fit maxWidth, returns array of lines
  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }


  const handleDownloadWithOverlay = async () => {
    if (!selectedSlot?.imageUrl) return;
    setOverlayRendering(true);
    try {
      // Use already-composited URL if available, otherwise composite now
      const dataUrl = compositedUrls[selectedSlot.id]
        || (selectedSlot.overlayConfig
          ? await compositeImageWithOverlay(selectedSlot.imageUrl, selectedSlot.overlayConfig, selectedSlot.type)
          : selectedSlot.imageUrl);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${selectedSlot.type}_${inputs.productName || 'image'}.png`;
      a.click();
    } finally {
      setOverlayRendering(false);
    }
  };

  // ── Auto-composite: runs Canvas ONCE per slot, stores in local state ────────
  // CRITICAL: stores in compositedUrls (NOT imageUrl) to prevent double-composite.
  // imageUrl always stays as the raw product photo.
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
        // Store in local state — NEVER replaces imageUrl (prevents double-composite)
        setCompositedUrls(prev => ({ ...prev, [slot.id]: composited }));
        console.log(`[RightPanel] Composited slot=${slot.id}`);
      } catch (e) {
        console.warn(`[RightPanel] Composite failed slot=${slot.id}:`, e);
        compositing.current.delete(slot.id); // allow retry
      }
    });
  }, [imageSlots, compositeImageWithOverlay]);


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
          // Use pre-composited URL if ready, otherwise composite now (single pass only)
          let dataUrl = compositedUrls[slot.id];
          if (!dataUrl && slot.overlayConfig) {
            dataUrl = await compositeImageWithOverlay(slot.imageUrl!, slot.overlayConfig, slot.type);
          }
          if (!dataUrl) dataUrl = slot.imageUrl!;
          // data URL → blob
          const arr  = dataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)![1];
          const bstr = atob(arr[1]);
          const u8   = new Uint8Array(bstr.length);
          for (let j = 0; j < bstr.length; j++) u8[j] = bstr.charCodeAt(j);
          folder.file(`image_0${i + 1}_${slot.type}.png`, new Blob([u8], { type: mime }));
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
                src={compositedUrls[selectedSlot.id] || selectedSlot.imageUrl}
                alt={selectedSlot.title}
                id={`preview-image-${selectedSlot.id}`}
                style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 280px)', objectFit: 'contain' }}
              />

              {/* Compositing indicator */}
              {selectedSlot.overlayConfig && !compositedUrls[selectedSlot.id] && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 12, fontSize: 12, color: '#666', gap: 6,
                }}>
                  <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
                  Compositing layout…
                </div>
              )}

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
