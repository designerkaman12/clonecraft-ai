// kie.ai unified API client — using documented endpoints
// Generate: POST /api/v1/gpt4o-image/generate  → returns { data: { taskId } }
// Poll:     GET  /api/v1/gpt4o-image/record-info?taskId=  → data.response.resultUrls[]
// Chat:     POST /v1/chat/completions (OpenAI-compatible)
// Market:   POST /api/v1/market/task  → for recraft, topaz, etc.

const KIE_BASE = (process.env.KIE_API_BASE_URL || 'https://api.kie.ai').replace(/\/$/, '');
const KIE_KEY  = process.env.KIE_API_KEY || '';

export const kieHeaders = () => ({
  Authorization: `Bearer ${KIE_KEY}`,
  'Content-Type': 'application/json',
});

// Model slug map: model → path prefix on api.kie.ai
// Format: https://api.kie.ai/{slug}/v1/chat/completions
const MODEL_SLUGS: Record<string, string> = {
  'gpt-4o':    'gpt-5-2',
  'gpt-4o-mini': 'gpt-5-2',
  'gpt-5-2':   'gpt-5-2',
  'gpt-5-4':   'gpt-5-4',
  'gpt-4':     'gpt-5-2',
};

// ─── Chat / LLM ─────────────────────────────────────────────
// Endpoint: POST https://api.kie.ai/{model-slug}/v1/chat/completions
export async function kieChat(
  messages: { role: string; content: string | any[] }[],
  model = 'gpt-4o'
): Promise<string> {
  const slug = MODEL_SLUGS[model] ?? 'gpt-5-2';
  const url = `${KIE_BASE}/${slug}/v1/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify({ messages, temperature: 0.7 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`kie chat error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content as string) ?? '';
}

// ─── 4o Image Generation ────────────────────────────────────
// POST /api/v1/gpt4o-image/generate
// Body: { prompt, size (ratio like "1:1"), filesUrl?, isEnhance? }
export async function kieGenerateImage(
  prompt: string,
  aspectRatio = '1:1'
): Promise<string> {
  const body = {
    prompt,
    size: aspectRatio, // API accepts "1:1", "4:5", "16:9", "9:16", "3:4"
    isEnhance: false,
    uploadCn: false,
    enableFallback: false,
  };

  const res = await fetch(`${KIE_BASE}/api/v1/gpt4o-image/generate`, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`kie image generate error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data.code !== 200 && data.code !== 0) {
    throw new Error(`kie API error: ${data.msg || JSON.stringify(data)}`);
  }

  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('No taskId returned from generate endpoint');

  return await poll4oTask(taskId);
}

// ─── Poll 4o task until SUCCESS ───────────────────────────
// GET /api/v1/gpt4o-image/record-info?taskId=...
// Response: data.status = "SUCCESS" | "FAILED" | "IN_QUEUE" | "IN_PROGRESS"
// Image URL: data.response.resultUrls[0]
export async function poll4oTask(
  taskId: string,
  maxAttempts = 40,
  intervalMs = 4000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await delay(intervalMs);

    const res = await fetch(
      `${KIE_BASE}/api/v1/gpt4o-image/record-info?taskId=${taskId}`,
      { headers: kieHeaders() }
    );

    if (!res.ok) {
      console.warn(`Poll attempt ${i + 1} returned ${res.status}, retrying...`);
      continue;
    }

    const data = await res.json();
    const record = data.data;
    const status: string = record?.status ?? '';

    if (status === 'SUCCESS' || record?.successFlag === 1) {
      const urls: string[] = record?.response?.resultUrls ?? [];
      if (urls.length > 0) return urls[0];
      throw new Error('Task succeeded but no result URLs returned');
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`kie task ${taskId} failed: ${record?.errorMessage || status}`);
    }

    console.log(`Task ${taskId}: ${status} (attempt ${i + 1}/${maxAttempts})`);
  }

  throw new Error(`kie task ${taskId} timed out after ${maxAttempts} attempts`);
}

// ─── Market API tasks (recraft, topaz, etc.) ─────────────────
// POST /api/v1/market/task → returns { data: { taskId } }
// GET  /market/common/get-task-detail?taskId=  → polls result
export async function kieMarketTask(
  model: string,
  input: Record<string, unknown>
): Promise<string> {
  const body = { model, input };

  const res = await fetch(`${KIE_BASE}/api/v1/market/task`, {
    method: 'POST',
    headers: kieHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`kie market task error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const taskId = data?.data?.task_id ?? data?.data?.taskId ?? data?.task_id;
  if (!taskId) throw new Error(`No taskId from market task: ${JSON.stringify(data)}`);

  return await pollMarketTask(taskId);
}

// Poll market task
export async function pollMarketTask(
  taskId: string,
  maxAttempts = 30,
  intervalMs = 3000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await delay(intervalMs);

    const res = await fetch(
      `${KIE_BASE}/api/v1/market/task/${taskId}`,
      { headers: kieHeaders() }
    );

    if (!res.ok) continue;
    const data = await res.json();
    const output = data?.data?.output ?? data?.output ?? {};
    const status: string = data?.data?.status ?? data?.status ?? '';

    if (status === 'succeeded' || status === 'completed' || status === 'success') {
      return output?.imageUrl ?? output?.url ?? output?.image_url ?? '';
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(`Market task ${taskId} failed`);
    }
  }
  throw new Error(`Market task ${taskId} timed out`);
}

// ─── Background Removal via recraft ─────────────────────────
export async function kieRemoveBackground(imageUrl: string): Promise<string> {
  return kieMarketTask('recraft/remove-background', { image_url: imageUrl });
}

// ─── Image Upscale via Topaz ─────────────────────────────────
export async function kieUpscaleImage(imageUrl: string): Promise<string> {
  return kieMarketTask('topaz/image-upscale', { image_url: imageUrl, scale: 4 });
}

// ─── Utility ─────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
