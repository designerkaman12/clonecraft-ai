import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';
import type { ProductData, DesignSystem } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { referenceProductData, imageUrls } = await req.json() as {
      referenceProductData: ProductData | null | undefined;
      imageUrls: string[];
    };

    // Guard: if no reference data, return sensible defaults immediately
    if (!referenceProductData) {
      return NextResponse.json({
        success: true,
        data: {
          imageCount: 7,
          imageOrder: ['hero', 'feature_highlight', 'before_after', 'how_to_use', 'use_cases', 'creative_1', 'creative_2'],
          layoutStyle: 'centered', productPlacement: 'center', textPlacement: 'bottom',
          backgroundType: 'pure-white', lightingStyle: 'studio', typographyFeel: 'bold',
          iconUsage: true, spacing: 'balanced', compositionBalance: 'symmetric',
          colorMood: 'neutral', overallTone: 'premium',
        },
      });
    }

    const prompt = `You are an expert ecommerce creative director and design analyst.

Analyze the following reference product listing data and extract its complete design system.

Product Title: ${referenceProductData.title}
Category: ${referenceProductData.category || 'General'}
Bullet Points: ${referenceProductData.bullets?.slice(0, 3).join(' | ')}
Image Count: ${imageUrls.length || 'unknown'}

Based on this product category and listing structure, infer and return the complete design system as JSON:
{
  "imageCount": <number, typically 6-8>,
  "imageOrder": ["hero", "feature_highlight", "before_after", "how_to_use", "use_cases", "creative_1", "creative_2"],
  "layoutStyle": "<centered/split/full-bleed/grid>",
  "productPlacement": "<center/left/right/floating>",
  "textPlacement": "<bottom/top/left/right/overlay>",
  "backgroundType": "<pure-white/gradient/lifestyle/textured/pattern>",
  "lightingStyle": "<studio/natural/dramatic/soft>",
  "typographyFeel": "<bold/elegant/minimal/technical/playful>",
  "iconUsage": <true/false>,
  "spacing": "<tight/balanced/airy>",
  "compositionBalance": "<symmetric/asymmetric/rule-of-thirds>",
  "colorMood": "<warm/cool/neutral/vibrant/muted>",
  "overallTone": "<premium/bold/minimal/luxury/technical>"
}

Return ONLY valid JSON. Infer from the product category — for skincare use minimal/elegant, for electronics use technical/bold, for food use vibrant/warm.`;

    const result = await kieChat([{ role: 'user', content: prompt }]);

    let designSystem: DesignSystem;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      designSystem = JSON.parse(jsonMatch![0]);
    } catch {
      // Sensible defaults
      designSystem = {
        imageCount: 7,
        imageOrder: ['hero', 'feature_highlight', 'before_after', 'how_to_use', 'use_cases', 'creative_1', 'creative_2'],
        layoutStyle: 'centered',
        productPlacement: 'center',
        textPlacement: 'bottom',
        backgroundType: 'pure-white',
        lightingStyle: 'studio',
        typographyFeel: 'bold',
        iconUsage: true,
        spacing: 'balanced',
        compositionBalance: 'symmetric',
        colorMood: 'neutral',
        overallTone: 'premium',
      };
    }

    return NextResponse.json({ success: true, data: designSystem });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
