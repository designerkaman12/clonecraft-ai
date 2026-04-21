import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';
import { v4 as uuidv4 } from 'uuid';
import type { DesignSystem, GeneratedContent, ColorPalette, ImageSlot, AspectRatio, Tone } from '@/lib/types';

const SLOT_TYPES: ImageSlot['type'][] = [
  'hero', 'feature', 'before_after', 'how_to_use', 'uses', 'creative_1', 'creative_2'
];

const SLOT_TITLES: Record<ImageSlot['type'], string> = {
  hero: '🏆 Hero / Main Image',
  feature: '⚡ Feature Highlight',
  before_after: '🔄 Before & After',
  how_to_use: '📋 How To Use',
  uses: '💡 Uses & Applications',
  creative_1: '🎨 Creative Visual 1',
  creative_2: '✨ Creative Visual 2',
  custom: '🖼️ Custom Image',
};

export async function POST(req: NextRequest) {
  try {
    const {
      productData,
      designSystem,
      generatedContent,
      colorPalette,
      aspectRatio,
      tone,
      backgroundStyle,
      imageCount,
      similarityLevel,
      productName,
    } = await req.json();

    const slotCount = Math.min(imageCount || 7, SLOT_TYPES.length);
    const selectedTypes = SLOT_TYPES.slice(0, slotCount);

    const colorDesc = colorPalette
      ? `Primary: ${colorPalette.primary}, Secondary: ${colorPalette.secondary}, Accent: ${colorPalette.accent}`
      : 'balanced, brand-appropriate colors';

    const similarityInstructions: Record<string, string> = {
      low: 'Be highly creative and original. Only loosely follow the reference layout.',
      medium: 'Balance between reference layout and creative freedom.',
      high: 'Closely follow the reference design system layout and composition.',
    };

    const promptsResult = await kieChat([
      {
        role: 'user',
        content: `You are an expert ecommerce image prompt engineer specializing in Amazon/Flipkart product listings.

PRODUCT: "${productName || productData?.title}"
ASPECT RATIO: ${aspectRatio}
TONE: ${tone}
BACKGROUND STYLE: ${backgroundStyle}
COLOR PALETTE: ${colorDesc}
DESIGN SYSTEM:
- Layout: ${designSystem?.layoutStyle || 'centered'}
- Product Placement: ${designSystem?.productPlacement || 'center'}
- Text Placement: ${designSystem?.textPlacement || 'bottom'}
- Background: ${designSystem?.backgroundType || 'pure-white'}
- Lighting: ${designSystem?.lightingStyle || 'studio'}
- Typography: ${designSystem?.typographyFeel || 'bold'}
SIMILARITY LEVEL: ${similarityInstructions[similarityLevel] || similarityInstructions.medium}

Generate ONE detailed image generation prompt for EACH of these image types:
${selectedTypes.map((t, i) => `${i + 1}. ${SLOT_TITLES[t]} (type: ${t})`).join('\n')}

For each image, the prompt must include:
- Product: describe the product clearly (clean, studio-quality render)
- Composition & Layout
- Background & Setting  
- Lighting & Mood
- Text overlay description (what text appears and where)
- Color treatment
- Style keywords for AI image generation

CRITICAL RULES:
- Each image must look like a professional Amazon/Flipkart listing image
- No copyrighted brand names, logos, or reference product details
- Product should be the clear focal point
- Text overlays should be described precisely
- Optimized for high conversion

Return ONLY this JSON (no markdown, no explanation):
{
  "prompts": {
    "hero": "detailed prompt here...",
    "feature": "detailed prompt here...",
    "before_after": "detailed prompt here...",
    "how_to_use": "detailed prompt here...",
    "uses": "detailed prompt here...",
    "creative_1": "detailed prompt here...",
    "creative_2": "detailed prompt here..."
  }
}`,
      },
    ]);

    let promptsData: Record<string, string> = {};
    try {
      const jsonMatch = promptsResult.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch![0]);
      promptsData = parsed.prompts || parsed;
    } catch {
      // Fallback prompts
      selectedTypes.forEach((type) => {
        promptsData[type] = `Professional ecommerce product photo, ${productName}, clean white background, studio lighting, high quality, Amazon listing style`;
      });
    }

    // Build ImageSlot array
    const slots: ImageSlot[] = selectedTypes.map((type, index) => ({
      id: uuidv4(),
      index,
      type,
      title: SLOT_TITLES[type],
      prompt: promptsData[type] || `Product photo for ${type}`,
      status: 'pending',
    }));

    return NextResponse.json({ success: true, data: slots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
