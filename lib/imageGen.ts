/**
 * imageGen.ts — Browser-side image generation using kie.ai Flux-2 Market API
 *
 * Uses the Market API (POST /api/v1/jobs/createTask) instead of the gpt4o-image
 * endpoint to avoid OpenAI content policy restrictions.
 *
 * Market API Flow:
 *   1. POST /api/v1/jobs/createTask → { data: { taskId } }
 *   2. GET  /api/v1/jobs/recordInfo?taskId=... → poll until state === "success"
 *   3. Parse resultJson → resultUrls[0]
 */

const KIE_BASE = (process.env.NEXT_PUBLIC_KIE_API_BASE_URL || 'https://api.kie.ai').replace(/\/$/, '');
const KIE_KEY  = process.env.NEXT_PUBLIC_KIE_API_KEY || '';

const headers = () => ({
  Authorization: `Bearer ${KIE_KEY}`,
  'Content-Type': 'application/json',
});

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Start generation via Market API ──────────────────────────────────────────
async function startFluxGeneration(prompt: string, aspectRatio: string): Promise<string> {
  // Market API uses aspect_ratio with underscore in some sizes; use the same values
  // Valid: "1:1" | "3:2" | "2:3" | "16:9" | "9:16" | "4:3" | "3:4"
  const ratio = aspectRatio || '1:1';

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: 'flux-2/flex-text-to-image',
      input: {
        prompt,
        aspect_ratio: ratio,
        resolution: '1K',    // "1K" | "2K" | "4K"
        nsfw_checker: false,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai Flux-2 generate failed (${res.status}): ${text.substring(0, 200)}`);
  }

  const data = await res.json();
  console.log('[imageGen/flux2] generate response:', JSON.stringify(data).substring(0, 200));

  if (data.code !== 200 && data.code !== 0) {
    throw new Error(`kie.ai Flux-2 error (${data.code}): ${data.msg || JSON.stringify(data)}`);
  }

  const taskId = data?.data?.taskId;
  if (!taskId) throw new Error('No taskId returned from kie.ai Flux-2');
  return taskId;
}

// ─── Poll until done ──────────────────────────────────────────────────────────
async function pollFluxUntilDone(
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
        `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers: headers() }
      );
      if (!res.ok) {
        console.warn(`[flux2/poll] attempt ${attempt} → HTTP ${res.status}, retrying...`);
        continue;
      }
      data = await res.json();
    } catch (e) {
      console.warn(`[flux2/poll] attempt ${attempt} network error, retrying...`);
      continue;
    }

    const record = data?.data ?? {};
    const state  = (record?.state ?? '').toLowerCase();

    // Estimate progress from costTime vs typical duration (~30s)
    const elapsed = Date.now() - (record?.createTime ?? Date.now());
    const pct = Math.min((elapsed / 60000) * 100, 95); // cap at 95% until success

    console.log(`[flux2/poll][${taskId}] attempt=${attempt} state=${state} elapsed=${Math.round(elapsed/1000)}s`);
    onProgress?.(pct, state);

    // ── Success ──────────────────────────────────────────────────────────────
    if (state === 'success') {
      let resultUrls: string[] = [];
      try {
        const parsed = JSON.parse(record?.resultJson || '{}');
        resultUrls = parsed?.resultUrls ?? [];
      } catch {
        resultUrls = [];
      }
      if (resultUrls.length > 0) {
        console.log(`[flux2] SUCCESS: ${resultUrls[0].substring(0, 80)}`);
        return resultUrls[0];
      }
      throw new Error('Flux-2 task succeeded but no image URLs returned');
    }

    // ── Failure ──────────────────────────────────────────────────────────────
    if (state === 'fail' || state === 'failed' || state === 'error') {
      throw new Error(
        `Flux-2 image generation failed (${state}): ${record?.failMsg || 'Unknown error'}`
      );
    }

    // pending / running → keep polling
  }

  throw new Error(`Flux-2 image generation timed out after ${maxMinutes} minutes. Please retry.`);
}

// ─── Public entry point ───────────────────────────────────────────────────────
export async function generateImageWithPolling(
  prompt: string,
  aspectRatio = '1:1',
  slotId: string,
  onProgress?: (pct: number, status: string) => void
): Promise<string> {
  // Keep prompts short — very long prompts can trigger failures
  const trimmed = prompt.trim().substring(0, 500);
  const finalPrompt = `${trimmed}. Professional product photography, clean background, high quality.`;

  console.log(`[imageGen] Starting Flux-2 for slotId=${slotId}, ratio=${aspectRatio}, promptLen=${finalPrompt.length}`);

  const taskId = await startFluxGeneration(finalPrompt, aspectRatio);
  console.log(`[imageGen] taskId=${taskId} — polling...`);

  const imageUrl = await pollFluxUntilDone(taskId, onProgress);
  console.log(`[imageGen] Done! slotId=${slotId} → ${imageUrl.substring(0, 80)}...`);

  return imageUrl;
}
