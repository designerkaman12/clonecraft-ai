'use client';
import { useState, useCallback } from 'react';
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

  // ── Canvas overlay compositor ────────────────────────────────────────────────
  const compositeImageWithOverlay = useCallback(async (
    imageUrl: string,
    overlay: OverlayConfig
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas  = document.createElement('canvas');
      const ctx     = canvas.getContext('2d')!;
      const img     = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width  = img.naturalWidth  || 1024;
        canvas.height = img.naturalHeight || 1024;
        ctx.drawImage(img, 0, 0);

        const W = canvas.width;
        const H = canvas.height;
        const pos = overlay.overlayPosition || 'bottom';
        const isTop = pos === 'top';
        const isLeft = pos === 'left';
        const isRight = pos === 'right';
        const panelH = Math.round(H * 0.30);

        // Gradient overlay bar
        let grd: CanvasGradient;
        if (isTop) {
          grd = ctx.createLinearGradient(0, 0, 0, panelH);
          grd.addColorStop(0, 'rgba(0,0,0,0.75)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, W, panelH);
        } else if (isLeft) {
          grd = ctx.createLinearGradient(0, 0, W * 0.45, 0);
          grd.addColorStop(0, 'rgba(0,0,0,0.78)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, W * 0.45, H);
        } else if (isRight) {
          grd = ctx.createLinearGradient(W, 0, W * 0.55, 0);
          grd.addColorStop(0, 'rgba(0,0,0,0.78)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(W * 0.55, 0, W, H);
        } else {
          // bottom (default)
          grd = ctx.createLinearGradient(0, H - panelH, 0, H);
          grd.addColorStop(0, 'rgba(0,0,0,0)');
          grd.addColorStop(1, 'rgba(0,0,0,0.82)');
          ctx.fillStyle = grd;
          ctx.fillRect(0, H - panelH, W, panelH);
        }

        // Text positioning
        const textX = isRight ? W * 0.58 : isLeft ? W * 0.04 : W * 0.05;
        let textY   = isTop ? H * 0.06 : isLeft || isRight ? H * 0.30 : H - panelH + H * 0.04;
        const maxTW = isLeft || isRight ? W * 0.38 : W * 0.88;
        const scale = W / 1024;

        // Badge
        if (overlay.badge) {
          const bFontSize = Math.round(18 * scale);
          ctx.font        = `700 ${bFontSize}px 'Arial', sans-serif`;
          const bPad      = Math.round(8 * scale);
          const bW        = ctx.measureText(overlay.badge).width + bPad * 2.5;
          const bH        = bFontSize + bPad * 1.4;
          const bX        = isRight ? W - bW - Math.round(16 * scale) : Math.round(16 * scale);
          const bY        = isTop ? Math.round(16 * scale) : H - bH - Math.round(16 * scale);
          ctx.fillStyle   = '#f59e0b';
          ctx.beginPath();
          ctx.roundRect(bX, bY, bW, bH, Math.round(6 * scale));
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.fillText(overlay.badge, bX + bPad, bY + bH - bPad * 0.9);
        }

        // Headline
        const hFontSize = Math.round(44 * scale);
        ctx.font        = `800 ${hFontSize}px 'Arial Black', 'Arial', sans-serif`;
        ctx.fillStyle   = overlay.textColor || '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur  = Math.round(8 * scale);
        const headline  = overlay.headline || '';
        // Wrap long headline
        const hWords    = headline.split(' ');
        let hLine       = '';
        for (const w of hWords) {
          const test = hLine ? hLine + ' ' + w : w;
          if (ctx.measureText(test).width > maxTW && hLine) {
            ctx.fillText(hLine, textX, textY + hFontSize);
            textY += hFontSize * 1.15;
            hLine = w;
          } else { hLine = test; }
        }
        ctx.fillText(hLine, textX, textY + hFontSize);
        textY += hFontSize * 1.3;

        // Subline
        if (overlay.subline) {
          const sFontSize = Math.round(26 * scale);
          ctx.font        = `400 ${sFontSize}px 'Arial', sans-serif`;
          ctx.fillStyle   = 'rgba(255,255,255,0.82)';
          ctx.shadowBlur  = Math.round(4 * scale);
          ctx.fillText(overlay.subline.substring(0, 60), textX, textY + sFontSize);
          textY += sFontSize * 1.5;
        }

        // Bullets (checkmarks)
        if (overlay.bullets && overlay.bullets.length > 0) {
          const bFontSize = Math.round(21 * scale);
          ctx.font        = `600 ${bFontSize}px 'Arial', sans-serif`;
          ctx.fillStyle   = '#ffffff';
          ctx.shadowBlur  = Math.round(3 * scale);
          for (const bullet of overlay.bullets.slice(0, 3)) {
            const line = `✓ ${bullet}`;
            ctx.fillText(line.substring(0, 45), textX, textY + bFontSize);
            textY += bFontSize * 1.45;
          }
        }

        ctx.shadowBlur = 0;
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });
  }, []);

  const handleDownloadWithOverlay = async () => {
    if (!selectedSlot?.imageUrl) return;
    setOverlayRendering(true);
    try {
      let dataUrl: string;
      if (showOverlay && selectedSlot.overlayConfig) {
        dataUrl = await compositeImageWithOverlay(selectedSlot.imageUrl, selectedSlot.overlayConfig);
      } else {
        const res  = await fetch(selectedSlot.imageUrl);
        const blob = await res.blob();
        dataUrl    = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
      }
      const a      = document.createElement('a');
      a.href       = dataUrl;
      a.download   = `${selectedSlot.type}_${inputs.productName || 'image'}.png`;
      a.click();
    } finally {
      setOverlayRendering(false);
    }
  };

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
          const imgRes = await fetch(slot.imageUrl!);
          folder.file(`image_0${i + 1}_${slot.type}.png`, await imgRes.blob());
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
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Generating image…</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, maxWidth: 180, lineHeight: 1.6 }}>
                kie.ai is rendering. Takes 30–90 seconds.
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

              {/* Text Overlay Preview — CSS-based live preview */}
              {showOverlay && selectedSlot.overlayConfig && (() => {
                const ov   = selectedSlot.overlayConfig!;
                const pos  = ov.overlayPosition || 'bottom';
                const isTop = pos === 'top';
                const overlayStyle: React.CSSProperties = {
                  position: 'absolute',
                  left: pos === 'right' ? 'auto' : 0,
                  right: pos === 'right' ? 0 : 'auto',
                  top: isTop ? 0 : 'auto',
                  bottom: isTop ? 'auto' : 0,
                  width: pos === 'left' || pos === 'right' ? '45%' : '100%',
                  height: isTop ? '35%' : pos === 'left' || pos === 'right' ? '100%' : '38%',
                  background: pos === 'left'
                    ? 'linear-gradient(to right, rgba(0,0,0,0.82), transparent)'
                    : pos === 'right'
                    ? 'linear-gradient(to left, rgba(0,0,0,0.82), transparent)'
                    : isTop
                    ? 'linear-gradient(to bottom, rgba(0,0,0,0.78), transparent)'
                    : 'linear-gradient(to top, rgba(0,0,0,0.84), transparent)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: isTop ? 'flex-start' : 'flex-end',
                  pointerEvents: 'none',
                };
                return (
                  <div style={overlayStyle}>
                    {ov.badge && (
                      <span style={{
                        alignSelf: 'flex-start', background: '#f59e0b', color: '#000',
                        fontSize: 9, fontWeight: 800, padding: '2px 6px',
                        borderRadius: 4, marginBottom: 5, letterSpacing: 0.5,
                      }}>{ov.badge}</span>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.25, textShadow: '0 1px 4px rgba(0,0,0,0.7)', marginBottom: 3 }}>
                      {ov.headline}
                    </div>
                    {ov.subline && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.82)', marginBottom: 4, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                        {ov.subline}
                      </div>
                    )}
                    {ov.bullets && ov.bullets.slice(0, 3).map((b, i) => (
                      <div key={i} style={{ fontSize: 9.5, color: '#fff', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.7)', marginBottom: 2 }}>
                        ✓ {b}
                      </div>
                    ))}
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
