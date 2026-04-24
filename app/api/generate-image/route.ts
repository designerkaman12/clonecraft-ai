import { NextRequest, NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const maxDuration = 120;

/**
 * POST /api/generate-image        → generates image via Gemini, returns { imageUrl (data URL) }
 * POST /api/generate-image?poll=1 → Gemini is sync, returns { done: true } immediately
 */
export async function POST(req: NextRequest) {
  const isPoll = req.nextUrl.searchParams.get('poll') === '1';
  return isPoll ? handlePoll(req) : handleStart(req);
}

// ─── Generate image via Gemini 2.5 Flash Image ───────────────────────────────
async function handleStart(req: NextRequest) {
  try {
    const { prompt, aspectRatio, slotId } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }
    if (!GEMINI_KEY) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    // Build a high-quality product photography prompt
    const finalPrompt = `${prompt.trim().substring(0, 1800)}. Professional product photography, clean composition, high quality, sharp details, commercial grade.`;

    console.log(`[generate-image] Gemini image gen START slot=${slotId}`);

    const res = await fetch(
      `${GEMINI_BASE}/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini image gen error ${res.status}: ${err.substring(0, 300)}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imgPart) {
      // Log text response if any
      const textPart = parts.find((p: any) => p.text);
      throw new Error(`No image in Gemini response. Text: ${textPart?.text?.substring(0, 200) ?? 'none'}`);
    }

    const { mimeType, data: b64 } = imgPart.inlineData;
    const imageUrl = `data:${mimeType};base64,${b64}`;

    console.log(`[generate-image] Gemini SUCCESS slot=${slotId} mime=${mimeType}`);

    return NextResponse.json({
      success: true,
      taskId: `gemini_${Date.now()}`,
      imageUrl,       // data URL — browser can display directly
      slotId,
      done: true,     // no polling needed
    });

  } catch (error: any) {
    console.error('[generate-image] Gemini error:', error?.message);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// ─── Poll (not needed for Gemini — kept for API compat) ──────────────────────
async function handlePoll(req: NextRequest) {
  try {
    const { imageUrl, slotId } = await req.json();
    if (imageUrl) {
      return NextResponse.json({ success: true, done: true, imageUrl, slotId });
    }
    return NextResponse.json({
      success: false, done: true,
      error: 'Gemini is synchronous — imageUrl should have been returned in the initial request.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
