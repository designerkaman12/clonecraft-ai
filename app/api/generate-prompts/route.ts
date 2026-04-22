import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';
import { v4 as uuidv4 } from 'uuid';
import type { ImageSlot, OverlayConfig } from '@/lib/types';

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

/** Sanitize prompt: cap at 350 chars, no brand names/model numbers */
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
    const productTitle = productData?.title || category;
    const bullets: string[] = (productData?.bullets || []).slice(0, 5);

    // ── Ask LLM for image prompts AND overlay text in one call ─────────────────
    const promptsResult = await kieChat([
      {
        role: 'user',
        content: `You are an AI image prompt engineer for ecommerce product photography (like Amazon listings).

PRODUCT: ${productTitle}
CATEGORY: ${category}
KEY FEATURES: ${bullets.join(' | ') || 'high quality product'}
BACKGROUND: ${bg}
TONE: ${tone || 'premium'}

For each image type below, provide:
1. A SHORT visual prompt (max 200 chars) - ONLY describe scene, lighting, composition. NO brand names.
2. Overlay text config for Amazon-style text on the image

Image types: ${selectedTypes.join(', ')}

Return ONLY this JSON (no markdown fences):
{
  "slots": {
    "hero": {
      "prompt": "product centered on pure white background, dramatic studio lighting, soft shadows",
      "overlay": {
        "headline": "Professional Grade Performance",
        "subline": "Engineered for Excellence",
        "bullets": ["Premium Quality", "Easy to Use", "Long Lasting"],
        "badge": "BEST SELLER",
        "overlayPosition": "bottom"
      }
    },
    "feature": {
      "prompt": "close-up macro detail shot, white background, key component highlighted",
      "overlay": {
        "headline": "Advanced Technology Inside",
        "subline": "3 Speed Settings",
        "bullets": ["Variable Speed Control", "Ergonomic Design", "Low Vibration"],
        "overlayPosition": "right"
      }
    },
    "before_after": {
      "prompt": "split composition showing contrast before and after, dramatic difference",
      "overlay": {
        "headline": "Remarkable Results",
        "subline": "See The Difference",
        "bullets": [],
        "badge": "BEFORE / AFTER",
        "overlayPosition": "top"
      }
    },
    "how_to_use": {
      "prompt": "hands holding product, demonstration shot, lifestyle white background",
      "overlay": {
        "headline": "Simple 3-Step Process",
        "subline": "Easy for Everyone",
        "bullets": ["Step 1: Prepare", "Step 2: Apply", "Step 3: Done"],
        "overlayPosition": "bottom"
      }
    },
    "uses": {
      "prompt": "product in real environment, lifestyle shot, natural lighting",
      "overlay": {
        "headline": "Versatile Applications",
        "subline": "Use It Anywhere",
        "bullets": ["Home Use", "Professional Use", "Daily Routine"],
        "overlayPosition": "left"
      }
    },
    "creative_1": {
      "prompt": "artistic product composition, dramatic lighting, dark or gradient background",
      "overlay": {
        "headline": "Premium Quality",
        "subline": "Crafted to Perfection",
        "bullets": [],
        "overlayPosition": "bottom"
      }
    },
    "creative_2": {
      "prompt": "lifestyle hero shot, product with accessories, aspirational scene",
      "overlay": {
        "headline": "Complete Solution",
        "subline": "Everything You Need",
        "bullets": [],
        "badge": "NEW",
        "overlayPosition": "top"
      }
    }
  }
}

IMPORTANT: Customize the overlay text for THIS specific product (${productTitle}). Make it compelling and relevant.`,
      },
    ]);

    // Parse response
    let slotsData: Record<string, { prompt: string; overlay: OverlayConfig }> = {};
    try {
      const jsonMatch = promptsResult.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch![0]);
      slotsData = parsed.slots || {};
    } catch {
      // Fallback
      selectedTypes.forEach((type) => {
        slotsData[type] = {
          prompt: `Professional ${category} product photo, ${bg} background, studio lighting`,
          overlay: {
            headline: productTitle.substring(0, 40),
            subline: `Premium ${category}`,
            bullets: bullets.slice(0, 3),
            overlayPosition: 'bottom',
          },
        };
      });
    }

    const slots: ImageSlot[] = selectedTypes.map((type, index) => {
      const slotData = slotsData[type] || {
        prompt: `Professional ${category} product photo, ${bg} background, studio lighting`,
        overlay: { headline: productTitle.substring(0, 40), overlayPosition: 'bottom' as const },
      };

      return {
        id: uuidv4(),
        index,
        type,
        title: SLOT_TITLES[type],
        prompt: sanitizePrompt(slotData.prompt, category),
        status: 'pending',
        overlayConfig: slotData.overlay,
      };
    });

    return NextResponse.json({ success: true, data: slots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
