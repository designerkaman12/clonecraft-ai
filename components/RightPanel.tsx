'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import axios from 'axios';
import JSZip from 'jszip';
import PromptEditor from './PromptEditor';

export default function RightPanel() {
  const {
    session, selectedSlotId, setSelectedSlotId,
    updateImageSlot, isExporting, setIsExporting,
  } = useStore();

  const { imageSlots, inputs, generatedContent, currentStep } = session;
  const selectedSlot = imageSlots.find(s => s.id === selectedSlotId) || null;

  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [regenerateReason, setRegenerateReason] = useState('');
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);

  // ─── Regenerate single image ───────────────────────────────────
  const handleRegenerate = async (slotId: string, customPrompt?: string) => {
    const slot = imageSlots.find(s => s.id === slotId);
    if (!slot) return;

    const promptToUse = customPrompt
      ? customPrompt + (regenerateReason ? `\n\nAdditional: ${regenerateReason}` : '')
      : slot.prompt;

    updateImageSlot(slotId, { status: 'generating', imageUrl: undefined });
    try {
      const res = await axios.post('/api/generate-image', {
        prompt: promptToUse,
        aspectRatio: inputs.aspectRatio,
        slotId,
      });
      if (res.data.success) {
        updateImageSlot(slotId, { status: 'done', imageUrl: res.data.data.imageUrl });
      } else {
        updateImageSlot(slotId, { status: 'error', errorMessage: res.data.error });
      }
    } catch (e: any) {
      updateImageSlot(slotId, { status: 'error', errorMessage: e.message });
    }
    setShowRegenerateInput(false);
    setRegenerateReason('');
  };

  // ─── Download single image ─────────────────────────────────────
  const handleDownloadSingle = async () => {
    if (!selectedSlot?.imageUrl) return;
    try {
      const res = await fetch(selectedSlot.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSlot.type}_${inputs.productName || 'image'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not download image. Try right-clicking to save.');
    }
  };

  // ─── Export ZIP ────────────────────────────────────────────────
  const handleExport = async () => {
    const doneSlots = imageSlots.filter(s => s.status === 'done' && s.imageUrl);
    if (doneSlots.length === 0) { alert('No images generated yet!'); return; }

    setIsExporting(true);
    try {
      const zip = new JSZip();
      const folderName = (inputs.productName || 'CloneCraft_Export').replace(/[^a-z0-9]/gi, '_');
      const folder = zip.folder(folderName)!;

      for (let i = 0; i < doneSlots.length; i++) {
        const slot = doneSlots[i];
        const filename = `image_0${i + 1}_${slot.type}.png`;
        try {
          const imgRes = await fetch(slot.imageUrl!);
          const blob = await imgRes.blob();
          folder.file(filename, blob);
        } catch { /* skip */ }
      }

      const promptsObj: Record<string, string> = {};
      doneSlots.forEach((s, i) => { promptsObj[`image_0${i + 1}_${s.type}`] = s.prompt; });
      folder.file('prompts.json', JSON.stringify(promptsObj, null, 2));

      if (generatedContent) {
        folder.file('content.json', JSON.stringify(generatedContent, null, 2));
      }

      folder.file('metadata.json', JSON.stringify({
        productName: inputs.productName,
        platform: inputs.platform,
        tone: inputs.tone,
        aspectRatio: inputs.aspectRatio,
        imageCount: doneSlots.length,
        generatedAt: new Date().toISOString(),
        generatedBy: 'CloneCraft AI v1.0',
      }, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const doneCount = imageSlots.filter(s => s.status === 'done').length;
  const isGenerating = currentStep === 'generating_images';

  return (
    <>
      {showPromptEditor && selectedSlotId && (
        <PromptEditor
          slotId={selectedSlotId}
          onClose={() => setShowPromptEditor(false)}
          onRegenerate={handleRegenerate}
        />
      )}

      <div className="panel panel-right">
        <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="panel-title">🖼️ Preview</div>
          {doneCount > 0 && (
            <span className="badge badge-emerald">{doneCount}/{imageSlots.length || '?'} done</span>
          )}
        </div>

        {/* Main Image Preview */}
        <div className="preview-canvas" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {selectedSlot?.status === 'generating' && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Generating image…</div>
              <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)', maxWidth: 200, lineHeight: 1.6 }}>
                kie.ai is rendering your image. This takes 30–90 seconds.
              </div>
            </div>
          )}
          {selectedSlot?.imageUrl && selectedSlot.status === 'done' && (
            <div className="preview-image-wrap" style={{ position: 'relative' }}>
              <img
                src={selectedSlot.imageUrl}
                alt={selectedSlot.title}
                id={`preview-image-${selectedSlot.id}`}
              />
              {/* Floating controls over image */}
              <div style={{
                position: 'absolute', top: 8, right: 8,
                display: 'flex', gap: 6,
              }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleDownloadSingle}
                  data-tooltip="Download this image"
                  style={{ backdropFilter: 'blur(8px)', background: 'rgba(13,13,20,0.7)' }}
                >
                  ⬇️
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowPromptEditor(true)}
                  data-tooltip="Edit prompt"
                  style={{ backdropFilter: 'blur(8px)', background: 'rgba(13,13,20,0.7)' }}
                >
                  ✏️
                </button>
              </div>
            </div>
          )}
          {selectedSlot?.status === 'error' && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rose)' }}>Generation Failed</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, maxWidth: 220, lineHeight: 1.6 }}>
                {selectedSlot.errorMessage}
              </div>
              <button
                className="btn btn-danger btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => handleRegenerate(selectedSlot.id)}
              >
                🔄 Retry
              </button>
            </div>
          )}
          {!selectedSlot && (
            <div className="preview-placeholder">
              <div className="preview-placeholder-icon">🎨</div>
              <h3>Preview Area</h3>
              <p>Generated images appear here. Select any slot below to preview.</p>
            </div>
          )}
        </div>

        {/* Slot Info Bar */}
        {selectedSlot && (
          <div style={{
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSlot.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                Slot {(imageSlots.findIndex(s => s.id === selectedSlot.id) + 1)} · {inputs.aspectRatio}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowPromptEditor(true)}
            >
              Edit Prompt
            </button>
          </div>
        )}

        {/* Thumbnail Strip */}
        {imageSlots.length > 0 && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {imageSlots.map((slot, i) => (
                <div
                  key={slot.id}
                  id={`slot-thumb-${slot.id}`}
                  onClick={() => setSelectedSlotId(slot.id)}
                  style={{
                    width: 50, height: 50, flexShrink: 0,
                    borderRadius: 8,
                    border: `2px solid ${selectedSlotId === slot.id ? 'var(--indigo)' : 'var(--border)'}`,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    background: 'var(--bg-card)',
                    transition: 'all 0.2s',
                    transform: selectedSlotId === slot.id ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {slot.imageUrl ? (
                    <img src={slot.imageUrl} alt={slot.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, position: 'relative' }}>
                      {slot.status === 'generating' && <div className="slot-shimmer" />}
                      <span style={{ position: 'relative', zIndex: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                    </div>
                  )}
                  {/* Status indicator */}
                  <div style={{
                    position: 'absolute', bottom: 2, right: 2,
                    width: 6, height: 6, borderRadius: '50%',
                    background: slot.status === 'done' ? 'var(--emerald)'
                      : slot.status === 'error' ? 'var(--rose)'
                      : slot.status === 'generating' ? 'var(--amber)'
                      : 'var(--text-muted)',
                    boxShadow: slot.status === 'generating' ? '0 0 6px var(--amber)' : undefined,
                  }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>

          {/* Per-slot actions */}
          {selectedSlot && (selectedSlot.status === 'done' || selectedSlot.status === 'error') && (
            <>
              {showRegenerateInput ? (
                <div>
                  <input
                    className="form-input"
                    placeholder="Change instructions (optional)..."
                    value={regenerateReason}
                    onChange={e => setRegenerateReason(e.target.value)}
                    style={{ marginBottom: 6 }}
                    onKeyDown={e => e.key === 'Enter' && handleRegenerate(selectedSlot.id)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      id="btn-confirm-regenerate"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => handleRegenerate(selectedSlot.id)}
                    >
                      🔄 Regenerate
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowRegenerateInput(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    id="btn-regenerate"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setShowRegenerateInput(true)}
                  >
                    🔄 Regenerate
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowPromptEditor(true)}
                    data-tooltip="Edit prompt and regenerate"
                  >
                    ✏️ Edit
                  </button>
                  {selectedSlot.status === 'done' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleDownloadSingle}
                      data-tooltip="Download this image"
                    >
                      ⬇️
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Export ZIP */}
          {doneCount > 0 && (
            <button
              id="btn-export-zip"
              className="btn btn-primary btn-full"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Packaging ZIP…</>
              ) : (
                <>📦 Export All ({doneCount} image{doneCount !== 1 ? 's' : ''})</>
              )}
            </button>
          )}

          {imageSlots.length === 0 && currentStep === 'idle' && (
            <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Configure and generate to see your creatives here
            </div>
          )}
        </div>
      </div>
    </>
  );
}
