import { NextRequest, NextResponse } from 'next/server';

const KIE_BASE = (process.env.KIE_API_BASE_URL || 'https://api.kie.ai').replace(/\/$/, '');
const KIE_KEY  = process.env.KIE_API_KEY || '';

const kieHeaders = () => ({
  Authorization: `Bearer ${KIE_KEY}`,
  'Content-Type': 'application/json',
});

export const maxDuration = 300; // 5 min (only works on Vercel Pro — on Render we use /start + /poll split)

// POST /api/generate-image        → starts generation, returns { taskId }
// POST /api/generate-image?poll=1 → polls taskId, returns { done, imageUrl?, error? }
export async function POST(req: NextRequest) {
  const isPoll = req.nextUrl.searchParams.get('poll') === '1';

  if (isPoll) {
    return handlePoll(req);
  }
  return handleStart(req);
}

// ─── Step 1: Start generation ────────────────────────────────
async function handleStart(req: NextRequest) {
  try {
    const { prompt, aspectRatio, slotId } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }
    if (!KIE_KEY) {
      return NextResponse.json({ success: false, error: 'KIE_API_KEY not configured' }, { status: 500 });
    }

    const finalPrompt = `${prompt.trim()}\n\nPhotography requirements: Professional ecommerce product photography, razor sharp focus, commercial studio quality, no text artifacts, no watermarks, suitable for Amazon/Flipkart listing image.`;

    console.log(`[generate-image] START slot=${slotId} ratio=${aspectRatio}`);

    const res = await fetch(`${KIE_BASE}/api/v1/gpt4o-image/generate`, {
      method: 'POST',
      headers: kieHeaders(),
      body: JSON.stringify({
        prompt: finalPrompt,
        size: aspectRatio || '1:1',
        isEnhance: false,
        uploadCn: false,
        enableFallback: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`kie generate ${res.status}: ${err}`);
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

// ─── Step 2: Poll task status ─────────────────────────────────
async function handlePoll(req: NextRequest) {
  try {
    const { taskId, slotId } = await req.json();
    if (!taskId) return NextResponse.json({ success: false, error: 'taskId required' }, { status: 400 });

    const res = await fetch(
      `${KIE_BASE}/api/v1/gpt4o-image/record-info?taskId=${taskId}`,
      { headers: kieHeaders() }
    );

    if (!res.ok) {
      return NextResponse.json({ success: true, done: false, status: 'polling' });
    }

    const data = await res.json();
    const record = data.data;
    const status: string = record?.status ?? '';
    const progress: string = record?.progress ?? '0';

    console.log(`[poll] taskId=${taskId} status=${status} progress=${progress}`);

    if (status === 'SUCCESS' || record?.successFlag === 1) {
      const urls: string[] = record?.response?.resultUrls ?? [];
      if (urls.length > 0) {
        return NextResponse.json({ success: true, done: true, imageUrl: urls[0], slotId });
      }
      return NextResponse.json({ success: false, done: true, error: 'No result URLs in response' });
    }

    if (status === 'FAILED' || status === 'ERROR') {
      return NextResponse.json({
        success: false, done: true,
        error: record?.errorMessage || `Task failed with status: ${status}`
      });
    }

    // Still running
    return NextResponse.json({
      success: true, done: false,
      status, progress, slotId
    });

  } catch (error: any) {
    console.error('[generate-image] poll error:', error?.message);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
