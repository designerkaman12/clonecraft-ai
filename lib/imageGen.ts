/**
 * imageGen.ts — Image generation via Gemini 2.5 Flash Image (through our Next.js API route)
 *
 * Gemini image gen is synchronous — no polling needed.
 * Returns a base64 data URL: "data:image/png;base64,..."
 */

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Public entry point ───────────────────────────────────────────────────────
export async function generateImageWithPolling(
  prompt: string,
  aspectRatio = '1:1',
  slotId: string,
  onProgress?: (pct: number, status: string) => void,
  productImageUrl?: string   // kept for API compat — not used by Gemini text-to-image
): Promise<string> {

  const finalPrompt = `${prompt.trim().substring(0, 1800)}. Professional product photography, sharp details, high quality, commercial grade.`;

  console.log(`[imageGen/gemini] slotId=${slotId} ratio=${aspectRatio} promptLen=${finalPrompt.length}`);

  onProgress?.(10, 'generating');

  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: finalPrompt,
      aspectRatio,
      slotId,
    }),
  });

  onProgress?.(70, 'processing');

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini image request failed (${res.status}): ${err.substring(0, 200)}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Image generation failed');
  }

  const imageUrl = data.imageUrl;
  if (!imageUrl) throw new Error('No image URL returned from Gemini');

  onProgress?.(100, 'success');
  console.log(`[imageGen/gemini] Done! slotId=${slotId}`);

  return imageUrl;
}
