import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';
import { v4 as uuidv4 } from 'uuid';
import type { ImageSlot } from '@/lib/types';

const SLOT_TYPES: ImageSlot['type'][] = [
  'hero', 'feature', 'before_after', 'how_to_use', 'uses', 'creative_1', 'creative_2'
];

const SLOT_TITLES: Record<ImageSlot['type'], string> = {
  hero:         '🏆 Hero / Main Image',
  feature:      '⚡ Feature Highlight',
  before_after: '🔄 Before & After',
  how_to_use:   '📋 How To Use',
  uses:         '💡 Uses & Applications',
  creative_1:   '🎨 Creative Visual 1',
  creative_2:   '✨ Creative Visual 2',
  custom:       '🖼️ Custom Image',
};

/** Sanitize prompt: cap at 350 chars, no brand names/model numbers that can trigger policy flags */
function sanitizePrompt(prompt: string, category: string): string {
  let clean = prompt
    .replace(/\b[A-Z][a-zA-Z0-9]*\s*(M\d+|Pro|Max|Plus|Ultra|Elite|V\d)\b/g, `${category} product`)
    .replace(/["""'']/g, '')
    .trim();
  if (clean.length > 350) clean = clean.substring(0, 350).replace(/\s\S*$/, '') + '.';
  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const {
      productData,
      colorPalette,
      aspectRatio,
      tone,
      backgroundStyle,
      imageCount,
    } = await req.json();

    const slotCount = Math.min(imageCount || 7, SLOT_TYPES.length);
    const selectedTypes = SLOT_TYPES.slice(0, slotCount);
    const category = productData?.category || 'product';
    const bg = backgroundStyle || 'clean white';

    const promptsResult = await kieChat([
      {
        role: 'user',
        content: `You are an AI image prompt engineer for ecommerce product photography.

Write one SHORT prompt per image type. Rules:
- Max 250 characters each
- Only describe the VISUAL scene (no brand names, no model numbers)
- Safe for AI image generation  
- Include: what product looks like + background + lighting + mood

CATEGORY: ${category}
BACKGROUND: ${bg}
TONE: ${tone || 'premium'}

Image types:
${selectedTypes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return ONLY JSON (no code fences):
{"prompts":{"hero":"...","feature":"...","before_after":"...","how_to_use":"...","uses":"...","creative_1":"...","creative_2":"..."}}`,
      },
    ]);

    let promptsData: Record<string, string> = {};
    try {
      const jsonMatch = promptsResult.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch![0]);
      promptsData = parsed.prompts || parsed;
    } catch {
      selectedTypes.forEach((type) => {
        promptsData[type] = `Professional ${category}, ${bg} background, studio lighting, product photography, ecommerce`;
      });
    }

    const slots: ImageSlot[] = selectedTypes.map((type, index) => ({
      id: uuidv4(),
      index,
      type,
      title: SLOT_TITLES[type],
      prompt: sanitizePrompt(
        promptsData[type] || `Professional ${category} product photo, ${bg} background, studio lighting`,
        category
      ),
      status: 'pending',
    }));

    return NextResponse.json({ success: true, data: slots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
