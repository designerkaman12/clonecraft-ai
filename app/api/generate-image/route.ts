import { NextRequest, NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const maxDuration = 120;

/**
 * POST /api/generate-image
 * Body: { prompt, aspectRatio, slotId, productImageBase64?, slotType?, overlayConfig? }
 *
 * Strategy:
 * - If productImageBase64 provided:
 *     → Return it as-is for the frontend Canvas compositor to create the Amazon-style layout
 * - If no product image:
 *     → Use Gemini text-to-image to generate a scene
 */
export async function POST(req: NextRequest) {
  const isPoll = req.nextUrl.searchParams.get('poll') === '1';
  return isPoll ? handlePoll(req) : handleStart(req);
}

async function handleStart(req: NextRequest) {
  try {
    const { prompt, aspectRatio, slotId, productImageBase64 } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    console.log(`[generate-image] START slot=${slotId} hasProductImage=${!!productImageBase64}`);

    let imageUrl: string;

    if (productImageBase64) {
      // ── Use uploaded product image directly ──────────────────────────────────
      // The frontend Canvas compositor will handle the text/layout overlay
      // This ensures the ACTUAL product is always shown, not a random AI-generated one
      imageUrl = productImageBase64;
      console.log(`[generate-image] Using uploaded product image for slot=${slotId}`);
    } else {
      // ── No product image → Gemini text-to-image ──────────────────────────────
      if (!GEMINI_KEY) {
        return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 });
      }
      imageUrl = await generateTextToImage(prompt, aspectRatio);
      console.log(`[generate-image] Gemini text-to-image SUCCESS slot=${slotId}`);
    }

    return NextResponse.json({
      success: true,
      taskId: `gen_${Date.now()}`,
      imageUrl,
      slotId,
      done: true,
    });

  } catch (error: any) {
    console.error('[generate-image] error:', error?.message);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// ─── Gemini Text-to-Image (fallback when no product photo) ───────────────────
async function generateTextToImage(prompt: string, aspectRatio = '1:1'): Promise<string> {
  const finalPrompt = `Professional Amazon product listing photo. ${prompt.trim().substring(0, 1500)}. Clean white background, studio lighting, sharp details, photorealistic, 4K quality, commercial grade.`;

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

  if (!imgPart) throw new Error('No image returned from Gemini');

  const { mimeType, data: b64 } = imgPart.inlineData;
  return `data:${mimeType};base64,${b64}`;
}

// ─── Poll (not needed — kept for API compat) ──────────────────────────────────
async function handlePoll(req: NextRequest) {
  try {
    const { imageUrl, slotId } = await req.json();
    if (imageUrl) return NextResponse.json({ success: true, done: true, imageUrl, slotId });
    return NextResponse.json({ success: false, done: true, error: 'No imageUrl provided' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
