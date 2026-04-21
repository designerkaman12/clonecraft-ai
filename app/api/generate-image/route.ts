import { NextRequest, NextResponse } from 'next/server';
import { kieGenerateImage } from '@/lib/kieClient';

export const maxDuration = 180; // 3 min timeout for image generation

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspectRatio, slotId } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const key = process.env.KIE_API_KEY;
    if (!key) {
      return NextResponse.json({ success: false, error: 'KIE_API_KEY not configured in .env.local' }, { status: 500 });
    }

    // Build a clean ecommerce-optimized prompt
    const finalPrompt = `${prompt.trim()}

Photography requirements: Professional ecommerce product photography, razor sharp focus, commercial studio quality, no text artifacts, no watermarks, suitable for Amazon/Flipkart hero listing image.`;

    console.log(`[generate-image] Generating for slot ${slotId}, ratio ${aspectRatio}`);

    const imageUrl = await kieGenerateImage(finalPrompt, aspectRatio || '1:1');

    if (!imageUrl) {
      throw new Error('Empty imageUrl returned — generation may have failed silently');
    }

    console.log(`[generate-image] Success for slot ${slotId}: ${imageUrl.substring(0, 60)}...`);
    return NextResponse.json({ success: true, data: { imageUrl, slotId } });

  } catch (error: any) {
    console.error('[generate-image] Error:', error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || 'Image generation failed' },
      { status: 500 }
    );
  }
}
