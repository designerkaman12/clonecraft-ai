'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import axios from 'axios';

interface PromptEditorProps {
  slotId: string;
  onClose: () => void;
  onRegenerate: (slotId: string, newPrompt?: string) => void;
}

export default function PromptEditor({ slotId, onClose, onRegenerate }: PromptEditorProps) {
  const { session, updateImageSlot } = useStore();
  const slot = session.imageSlots.find(s => s.id === slotId);
  const [prompt, setPrompt] = useState(slot?.prompt || '');
  const [saving, setSaving] = useState(false);

  if (!slot) return null;

  const handleSaveAndRegenerate = async () => {
    setSaving(true);
    // Save the prompt update
    updateImageSlot(slotId, { prompt });
    // Wait a tick for state to update, then regenerate
    setTimeout(() => {
      onRegenerate(slotId, prompt);
      onClose();
      setSaving(false);
    }, 100);
  };

  const handleSaveOnly = () => {
    updateImageSlot(slotId, { prompt });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          width: '100%',
          maxWidth: 680,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              ✏️ Edit Prompt
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {slot.title}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Image Prompt</label>
          <textarea
            className="form-input form-textarea"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={10}
            style={{ fontSize: 13, lineHeight: 1.7 }}
            placeholder="Describe the image in detail..."
          />
        </div>

        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--indigo-light)', fontWeight: 600, marginBottom: 4 }}>💡 Prompt Tips</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            • Describe product placement, composition, lighting, background<br/>
            • Mention color scheme, mood, and text overlay placement<br/>
            • Use "professional ecommerce photography" for best results<br/>
            • For text overlays: describe them as "bold white text in bottom-left corner"
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            id="btn-save-regenerate"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleSaveAndRegenerate}
            disabled={saving || !prompt.trim()}
          >
            {saving ? '⏳ Saving...' : '🔄 Save & Regenerate'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSaveOnly}
          >
            💾 Save Only
          </button>
          <button
            className="btn btn-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
