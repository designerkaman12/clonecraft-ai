/**
 * imageGen.ts — Image generation client
 *
 * KEY LOGIC:
 * - If productImageBase64 is provided (user uploaded their product photo):
 *     → Return it DIRECTLY without any API call
 *     → The Canvas compositor in RightPanel handles text/layout overlay
 *     → This guarantees the user's actual product is ALWAYS used
 *
 * - If no product image:
 *     → Call /api/generate-image (Gemini text-to-image)
 */

export async function generateImageWithPolling(
  prompt: string,
  aspectRatio = '1:1',
  slotId: string,
  onProgress?: (pct: number, status: string) => void,
  productImageBase64?: string   // base64 data URL of uploaded product photo
): Promise<string> {

  // ── FAST PATH: User uploaded their product photo ──────────────────────────
  // Return it immediately — no API call, no random AI generation
  // The Canvas compositor in RightPanel.tsx will overlay text on top
  if (productImageBase64) {
    console.log(`[imageGen] Using uploaded product image directly for slot=${slotId}`);
    onProgress?.(100, 'success');
    return productImageBase64;
  }

  // ── FALLBACK: No product image → Gemini text-to-image ─────────────────────
  console.log(`[imageGen] No product image, calling Gemini for slot=${slotId}`);
  onProgress?.(10, 'generating');

  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt.trim().substring(0, 1800),
      aspectRatio,
      slotId,
    }),
  });

  onProgress?.(70, 'processing');

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation failed (${res.status}): ${err.substring(0, 200)}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Image generation failed');
  }

  if (!data.imageUrl) {
    throw new Error('No image returned');
  }

  onProgress?.(100, 'success');
  console.log(`[imageGen] Gemini done! slotId=${slotId}`);

  return data.imageUrl;
}
