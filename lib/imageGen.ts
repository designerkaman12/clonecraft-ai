/**
 * imageGen.ts — Direct browser → kie.ai calls
 *
 * Why direct?: Render free tier has 30s server timeout.
 * kie.ai image generation takes 60–180s.
 * Solution: Call kie.ai directly from the browser. No server = no timeout.
 *
 * Flow:
 *   1. POST https://api.kie.ai/api/v1/gpt4o-image/generate  → { taskId }
 *   2. GET  https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=...
 *      → poll every 5s until status === "SUCCESS"
 */

const KIE_BASE = (process.env.NEXT_PUBLIC_KIE_API_BASE_URL || 'https://api.kie.ai').replace(/\/$/, '');
const KIE_KEY  = process.env.NEXT_PUBLIC_KIE_API_KEY || '';

const headers = () => ({
  Authorization: `Bearer ${KIE_KEY}`,
  'Content-Type': 'application/json',
});

// ─── Start generation ─────────────────────────────────────────
async function startImageGeneration(prompt: string, aspectRatio: string): Promise<string> {
  const res = await fetch(`${KIE_BASE}/api/v1/gpt4o-image/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      prompt,
      size: aspectRatio,  // "1:1" | "4:5" | "16:9" | "9:16" | "3:4"
      isEnhance: false,
      uploadCn: false,
      enableFallback: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai generate failed (${res.status}): ${text.substring(0, 200)}`);
  }

  const data = await res.json();
  if (data.code !== 200 && data.code !== 0) {
    throw new Error(`kie.ai error: ${data.msg || JSON.stringify(data)}`);
  }

  const taskId = data?.data?.taskId;
  if (!taskId) throw new Error('No taskId returned from kie.ai');
  return taskId;
}

// ─── Poll until done ──────────────────────────────────────────
async function pollUntilDone(
  taskId: string,
  onProgress?: (pct: number, status: string) => void,
  maxMinutes = 8
): Promise<string> {
  const maxAttempts = (maxMinutes * 60) / 5; // poll every 5s
  let attempt = 0;

  while (attempt < maxAttempts) {
    await delay(5000);
    attempt++;

    let data: any;
    try {
      const res = await fetch(
        `${KIE_BASE}/api/v1/gpt4o-image/record-info?taskId=${encodeURIComponent(taskId)}`,
        { headers: headers() }
      );
      if (!res.ok) {
        console.warn(`[poll] attempt ${attempt} → HTTP ${res.status}, retrying...`);
        continue;
      }
      data = await res.json();
    } catch (e) {
      console.warn(`[poll] attempt ${attempt} network error, retrying...`);
      continue;
    }

    const record  = data?.data ?? {};
    const status  = record?.status ?? '';
    const pct     = parseFloat(record?.progress ?? '0') * 100;

    console.log(`[poll][${taskId}] attempt=${attempt} status=${status} progress=${pct.toFixed(0)}%`);
    onProgress?.(pct, status);

    // ── Success ──────────────────────────────────────────────
    if (status === 'SUCCESS' || record?.successFlag === 1) {
      const urls: string[] = record?.response?.resultUrls ?? [];
      if (urls.length > 0) return urls[0];
      throw new Error('Task succeeded but no image URLs returned');
    }

    // ── Failure ──────────────────────────────────────────────
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`kie.ai task failed: ${record?.errorMessage || status}`);
    }

    // IN_QUEUE / GENERATING → keep polling
  }

  throw new Error(`Image generation timed out after ${maxMinutes} minutes. Please retry.`);
}

// ─── Public entry point ───────────────────────────────────────
export async function generateImageWithPolling(
  prompt: string,
  aspectRatio = '1:1',
  slotId: string,
  onProgress?: (pct: number, status: string) => void
): Promise<string> {
  const ecomPrompt = `${prompt.trim()}\n\nStyle requirements: Professional ecommerce product photography, razor-sharp focus, studio lighting, commercial quality, pure clean background, no text overlays, no watermarks. Suitable for Amazon/Flipkart product listing.`;

  console.log(`[imageGen] Starting for slotId=${slotId}, ratio=${aspectRatio}`);

  const taskId = await startImageGeneration(ecomPrompt, aspectRatio);
  console.log(`[imageGen] taskId=${taskId} — polling...`);

  const imageUrl = await pollUntilDone(taskId, onProgress);
  console.log(`[imageGen] Done! slotId=${slotId} → ${imageUrl.substring(0, 60)}...`);

  return imageUrl;
}

// ─── Utility ─────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
