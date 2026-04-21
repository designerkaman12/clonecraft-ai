import { NextRequest, NextResponse } from 'next/server';
import { kieRemoveBackground } from '@/lib/kieClient';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'Image URL required' }, { status: 400 });
    }

    const resultUrl = await kieRemoveBackground(imageUrl);
    return NextResponse.json({ success: true, data: { imageUrl: resultUrl } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
