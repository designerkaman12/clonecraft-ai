import { NextRequest, NextResponse } from 'next/server';
import type { ImageSlot, GeneratedContent } from '@/lib/types';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { slots, content, productName, metadata } = await req.json();

    // Build export data
    const promptsJson: Record<string, string> = {};
    slots.forEach((slot: ImageSlot, i: number) => {
      const filename = `image_0${i + 1}_${slot.type}`;
      promptsJson[filename] = slot.prompt;
    });

    const exportData = {
      productName,
      generatedAt: new Date().toISOString(),
      images: slots.map((slot: ImageSlot, i: number) => ({
        filename: `image_0${i + 1}_${slot.type}.png`,
        type: slot.type,
        title: slot.title,
        imageUrl: slot.imageUrl || slot.imageBase64,
      })).filter((img: any) => img.imageUrl),
      prompts: promptsJson,
      content,
      metadata,
    };

    return NextResponse.json({ success: true, data: exportData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
