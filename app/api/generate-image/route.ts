import { NextRequest, NextResponse } from 'next/server';

const KIE_BASE = (process.env.KIE_API_BASE_URL || 'https://api.kie.ai').replace(/\/$/, '');
const KIE_KEY  = process.env.KIE_API_KEY || '';

const kieHeaders = () => ({
  Authorization: `Bearer ${KIE_KEY}`,
  'Content-Type': 'application/json',
});

export const maxDuration = 300;

/**
 * POST /api/generate-image        → starts generation, returns { taskId }
 * POST /api/generate-image?poll=1 → polls taskId, returns { done, imageUrl?, error? }
 */
export async function POST(req: NextRequest) {
  const isPoll = req.nextUrl.searchParams.get('poll') === '1';
  return isPoll ? handlePoll(req) : handleStart(req);
}

// ─── Step 1: Start generation ─────────────────────────────────────────────────
async function handleStart(req: NextRequest) {
  try {
    const { prompt, aspectRatio, slotId } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }
    if (!KIE_KEY) {
      return NextResponse.json({ success: false, error: 'KIE_API_KEY not configured' }, { status: 500 });
    }

    // Keep prompt short — long prompts can cause failures
    const trimmed = prompt.trim().substring(0, 500);
    const finalPrompt = `${trimmed}. Professional product photography, clean background, high quality.`;

    console.log(`[generate-image] START slot=${slotId} ratio=${aspectRatio}`);

    const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: kieHeaders(),
      body: JSON.stringify({
        model: 'flux-2/flex-text-to-image',
        input: {
          prompt: finalPrompt,
          aspect_ratio: aspectRatio || '1:1',
          resolution: '1K',
          nsfw_checker: false,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`kie Flux-2 generate ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (data.code !== 200 && data.code !== 0) {
      throw new Error(`kie error: ${data.msg || JSON.stringify(data)}`);
    }

    const taskId = data.data?.taskId;
    if (!taskId) throw new Error('No taskId returned');

    console.log(`[generate-image] taskId=${taskId} for slot=${slotId}`);
    return NextResponse.json({ success: true, taskId, slotId });

  } catch (error: any) {
    console.error('[generate-image] start error:', error?.message);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// ─── Step 2: Poll task status ──────────────────────────────────────────────────
async function handlePoll(req: NextRequest) {
  try {
    const { taskId, slotId } = await req.json();
    if (!taskId) return NextResponse.json({ success: false, error: 'taskId required' }, { status: 400 });

    const res = await fetch(
      `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${taskId}`,
      { headers: kieHeaders() }
    );

    if (!res.ok) {
      return NextResponse.json({ success: true, done: false, status: 'polling' });
    }

    const data = await res.json();
    const record = data?.data ?? {};
    const state: string = (record?.state ?? '').toLowerCase();

    console.log(`[poll] taskId=${taskId} state=${state}`);

    if (state === 'success') {
      let resultUrls: string[] = [];
      try {
        resultUrls = JSON.parse(record?.resultJson || '{}')?.resultUrls ?? [];
      } catch { /* */ }

      if (resultUrls.length > 0) {
        return NextResponse.json({ success: true, done: true, imageUrl: resultUrls[0], slotId });
      }
      return NextResponse.json({ success: false, done: true, error: 'No result URLs in response' });
    }

    if (state === 'fail' || state === 'failed' || state === 'error') {
      return NextResponse.json({
        success: false, done: true,
        error: record?.failMsg || `Task failed with state: ${state}`
      });
    }

    // Still running
    return NextResponse.json({ success: true, done: false, status: state, slotId });

  } catch (error: any) {
    console.error('[generate-image] poll error:', error?.message);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
