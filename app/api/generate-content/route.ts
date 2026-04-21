import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';
import type { ProductData, GeneratedContent, Tone } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { productData, tone, platform, language } = await req.json() as {
      productData: ProductData;
      tone: Tone;
      platform: string;
      language: string;
    };

    const toneGuides: Record<Tone, string> = {
      premium: 'sophisticated, high-end, aspirational language with strong value proposition',
      bold: 'strong, confident, direct language with power words and urgency',
      minimal: 'clean, simple, benefit-focused language with white space vibes',
      luxury: 'exclusive, indulgent language that evokes aspiration and prestige',
      technical: 'specification-rich, precise language with data points and technical detail',
    };

    const platformGuide = platform === 'amazon'
      ? 'Amazon marketplace — emphasize features, benefits, and conversion'
      : platform === 'flipkart'
      ? 'Flipkart marketplace — focus on value, deals, and Indian consumer mindset'
      : 'Generic ecommerce';

    const prompt = `You are a world-class ecommerce copywriter. Generate compelling marketing content for this product.

PRODUCT DATA:
Title: ${productData.title}
Features: ${(productData.features || productData.bullets || []).slice(0, 5).join(', ')}
Benefits: ${(productData.benefits || []).slice(0, 3).join(', ')}
Category: ${productData.category || 'General'}

TONE: ${toneGuides[tone] || toneGuides.premium}
PLATFORM: ${platformGuide}
LANGUAGE: ${language || 'English'}

Generate content for 7 product listing images. Return ONLY this JSON structure:
{
  "headlines": [
    "Main hero headline (punchy, 5-8 words)",
    "Feature headline 1",
    "Feature headline 2",
    "How-to-use headline",
    "Use-case headline",
    "Creative headline 1",
    "Creative headline 2"
  ],
  "subheadings": [
    "Supporting line for hero",
    "Feature 1 subheading",
    "Feature 2 subheading",
    "Step-by-step subheading",
    "Versatility subheading",
    "Creative sub 1",
    "Creative sub 2"
  ],
  "featurePoints": [
    "✓ Feature point 1",
    "✓ Feature point 2",
    "✓ Feature point 3",
    "✓ Feature point 4",
    "✓ Feature point 5"
  ],
  "benefitLines": [
    "Benefit line 1 (outcome-focused)",
    "Benefit line 2",
    "Benefit line 3"
  ],
  "useCaseText": [
    "Use case 1",
    "Use case 2",
    "Use case 3"
  ],
  "callToAction": "Strong CTA (e.g. Shop Now / Order Today / Try It)",
  "tagline": "Short memorable brand tagline (under 6 words)"
}

CRITICAL: Do NOT copy any text from reference brand. Create 100% original content for this product.`;

    const result = await kieChat([{ role: 'user', content: prompt }]);

    let content: GeneratedContent;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      content = JSON.parse(jsonMatch![0]);
    } catch {
      content = {
        headlines: Array(7).fill('Premium Quality Product'),
        subheadings: Array(7).fill('Experience the difference'),
        featurePoints: ['✓ High Quality', '✓ Durable', '✓ Easy to Use'],
        benefitLines: ['Save time', 'Better results', 'Great value'],
        useCaseText: ['At home', 'For travel', 'Daily use'],
        callToAction: 'Shop Now',
        tagline: 'Quality You Can Trust',
      };
    }

    return NextResponse.json({ success: true, data: content });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
