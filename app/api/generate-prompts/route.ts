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
        content: `You are an Amazon product listing creative director. Generate image prompts and text for ${slotCount} product creatives.

PRODUCT: ${productTitle}
CATEGORY: ${category}
KEY FEATURES: ${bullets.join(' | ') || 'high quality product'}
BACKGROUND: ${bg}
TONE: ${tone || 'premium'}

CRITICAL RULES:
- Bullets MUST be in format "FEATURE NAME: short description" (e.g. "SECURE FIT: Keeps tool in place")
- Headline: bold, punchy, 3-5 words, ALL CAPS style
- Subline: descriptive sentence, 5-8 words
- Use ONLY features relevant to THIS product
- overlayPosition must be "top" for all slots

Return ONLY valid JSON (no markdown):
{
  "slots": {
    "hero": {
      "prompt": "product on pure white background, centered, dramatic studio lighting, soft shadow",
      "overlay": {
        "headline": "Save Space Stay Organized",
        "subline": "Perfect for Detailing Studios and Garages",
        "bullets": ["SECURE STORAGE: Wall-mounted holder keeps tools safe", "EASY ACCESS: Grab and go in seconds", "SPACE SAVING: Frees up valuable workspace"],
        "badge": "BEST SELLER",
        "overlayPosition": "top"
      }
    },
    "feature": {
      "prompt": "product detail shot highlighting key component, white background, macro focus",
      "overlay": {
        "headline": "Scratch Free Design",
        "subline": "Soft Edge Protection for Your Tools",
        "bullets": ["SOFT LINING: Prevents scratches and scuffs", "DURABLE METAL: Built strong to last", "SECURE GRIP: Non-slip inner material"],
        "overlayPosition": "top"
      }
    },
    "before_after": {
      "prompt": "split scene showing cluttered vs organized workspace, dramatic contrast",
      "overlay": {
        "headline": "Before After Transformation",
        "subline": "From Cluttered Mess to Perfect Order",
        "bullets": [],
        "badge": "BEFORE / AFTER",
        "overlayPosition": "top"
      }
    },
    "how_to_use": {
      "prompt": "hands installing product on wall, step by step demo, clean background",
      "overlay": {
        "headline": "Secure Wall Storage",
        "subline": "Keep Your Tools Organized and Protected",
        "bullets": ["EASY INSTALL: Mounts in minutes with included hardware", "WALL MOUNTED: Saves floor and shelf space", "UNIVERSAL FIT: Works with most polisher models"],
        "overlayPosition": "top"
      }
    },
    "uses": {
      "prompt": "product in real garage or studio environment, lifestyle shot, natural warm light",
      "overlay": {
        "headline": "Heavy Duty Metal Build",
        "subline": "Strong and Durable Construction",
        "bullets": ["RUST RESISTANT: Built for long-term use", "LONG LASTING: Reliable strength that lasts", "PRO GRADE: Trusted by detailing professionals"],
        "overlayPosition": "top"
      }
    },
    "creative_1": {
      "prompt": "product artistically lit against dark dramatic background, premium feel",
      "overlay": {
        "headline": "Premium Quality",
        "subline": "Crafted to Perfection",
        "bullets": [],
        "overlayPosition": "top"
      }
    },
    "creative_2": {
      "prompt": "product with accessories in aspirational garage setup, lifestyle hero shot",
      "overlay": {
        "headline": "Complete Solution",
        "subline": "Everything You Need for a Tidy Workspace",
        "bullets": [],
        "badge": "NEW",
        "overlayPosition": "top"
      }
    }
  }
}

IMPORTANT: Customize ALL text for THIS specific product (${productTitle}). Make headlines punchy. Bullets MUST use "LABEL: description" format.`,
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
