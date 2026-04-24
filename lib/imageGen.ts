/**
 * imageGen.ts — Image generation via Gemini (through /api/generate-image)
 *
 * When productImageBase64 is provided:
 *   → Gemini multimodal mode: uses the ACTUAL product photo as reference
 *   → Ensures the generated creative shows the real product, not a random one
 *
 * When no product image:
 *   → Standard text-to-image generation
 */

// ─── Public entry point ───────────────────────────────────────────────────────
export async function generateImageWithPolling(
  prompt: string,
  aspectRatio = '1:1',
  slotId: string,
  onProgress?: (pct: number, status: string) => void,
  productImageBase64?: string   // ← base64 data URL of uploaded product image
): Promise<string> {

  const finalPrompt = prompt.trim().substring(0, 1800);

  console.log(`[imageGen] slotId=${slotId} ratio=${aspectRatio} hasProductImage=${!!productImageBase64}`);

  onProgress?.(10, 'generating');

  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: finalPrompt,
      aspectRatio,
      slotId,
      productImageBase64: productImageBase64 || null,  // pass to route for multimodal
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
  console.log(`[imageGen] Done! slotId=${slotId}`);

  return data.imageUrl;
}
