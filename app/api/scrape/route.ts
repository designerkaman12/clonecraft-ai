import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';
import type { ProductData } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { url, type } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    // Try Apify scraping first (if token set)
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (apifyToken && url.includes('amazon')) {
      try {
        const data = await scrapeWithApify(url, apifyToken);
        return NextResponse.json({ success: true, data });
      } catch (e) {
        console.log('Apify failed, falling back to fetch+LLM extraction');
      }
    }

    // ── Step 1: Try to actually fetch the page HTML ──────────────────────────
    let pageText = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.google.com/',
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const html = await res.text();
        // Extract meaningful text from HTML — title + meta + visible text
        pageText = extractTextFromHtml(html);
        console.log(`[scrape] Fetched ${url} — extracted ${pageText.length} chars`);
      }
    } catch (fetchErr) {
      console.log(`[scrape] Page fetch failed: ${fetchErr} — falling back to URL-only inference`);
    }

    // ── Step 2: LLM extraction (with real page text if available) ─────────────
    const hasRealData = pageText.length > 200;
    const extractionPrompt = hasRealData
      ? `You are a product data extraction assistant. Extract product information from this ${type === 'reference' ? 'REFERENCE' : 'OWN PRODUCT'} listing page content.

URL: ${url}

PAGE CONTENT (first 3000 chars):
${pageText.substring(0, 3000)}

Extract the ACTUAL product details from the page content above. Do NOT guess or hallucinate — use only what is present in the page content.

Return ONLY this JSON:
{
  "title": "exact product title from page",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "features": ["feature 1", "feature 2"],
  "specs": {},
  "benefits": ["benefit 1", "benefit 2"],
  "usageInstructions": [],
  "imageUrls": [],
  "price": "price if visible",
  "category": "product category"
}`
      : `You are a product data extraction assistant. The URL below is from an ecommerce platform. Extract product details based on the URL slug/ASIN.

IMPORTANT: This is a ${type === 'reference' ? 'REFERENCE listing (for design inspiration only)' : 'OWN PRODUCT listing'}.
URL: ${url}

Look carefully at the URL slug for product clues (e.g. "wireless-earbuds", "car-polisher", etc.).

Return ONLY this JSON:
{
  "title": "product title inferred from URL",
  "bullets": ["feature 1", "feature 2", "feature 3"],
  "features": [],
  "specs": {},
  "benefits": [],
  "usageInstructions": [],
  "imageUrls": [],
  "price": "",
  "category": "category inferred from URL"
}`;

    const result = await kieChat([{ role: 'user', content: extractionPrompt }]);

    let productData: ProductData;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      productData = JSON.parse(jsonMatch[0]);
    } catch {
      productData = {
        title: 'Product from ' + new URL(url).hostname,
        bullets: [],
        features: [],
        specs: {},
        benefits: [],
        usageInstructions: [],
        imageUrls: [],
      };
    }

    console.log(`[scrape] Extracted product: "${productData.title}" (${type})`);
    return NextResponse.json({ success: true, data: productData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Extract readable text from HTML — strips tags, scripts, styles
 * Returns cleaned product-relevant text
 */
function extractTextFromHtml(html: string): string {
  return html
    // Remove scripts and styles completely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeWithApify(url: string, token: string): Promise<ProductData> {
  const actorId = url.includes('flipkart') ? 'dhrumil/flipkart-scraper' : 'junglee/amazon-crawler';
  const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startUrls: [{ url }], maxItems: 1 }),
  });
  if (!runRes.ok) throw new Error('Apify run failed');
  const runData = await runRes.json();
  const runId = runData.data.id;

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const statusData = await statusRes.json();
    if (statusData.data.status === 'SUCCEEDED') {
      const datasetRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}`
      );
      const items = await datasetRes.json();
      const item = items[0];
      return {
        title: item.title || item.name || '',
        bullets: item.bulletPoints || item.features || [],
        features: item.features || [],
        specs: item.specifications || {},
        benefits: [],
        usageInstructions: [],
        imageUrls: item.images || [],
        price: item.price || '',
        category: item.category || '',
      };
    }
    if (statusData.data.status === 'FAILED') throw new Error('Apify actor failed');
  }
  throw new Error('Apify timed out');
}
