import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';
import type { ProductData } from '@/lib/types';

// Scrapes product data from Amazon/Flipkart using Apify or falls back to LLM extraction
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
        console.log('Apify failed, falling back to LLM extraction');
      }
    }

    // LLM-based extraction from URL (works as general extractor)
    const extractionPrompt = `You are a product data extraction assistant. Given the following ${type === 'reference' ? 'REFERENCE' : 'OWN'} product URL from an ecommerce platform, extract as much product information as possible using your training data or make intelligent inferences.

Product URL: ${url}

Return a JSON object with this EXACT structure (fill with realistic product data based on URL hints):
{
  "title": "Full product title",
  "bullets": ["Feature bullet 1", "Feature bullet 2", "Feature bullet 3", "Feature bullet 4", "Feature bullet 5"],
  "features": ["Feature 1", "Feature 2"],
  "specs": {"weight": "...", "dimensions": "...", "material": "..."},
  "benefits": ["Benefit 1", "Benefit 2"],
  "usageInstructions": ["Step 1", "Step 2"],
  "material": "...",
  "size": "...",
  "packagingDetails": "...",
  "imageUrls": [],
  "price": "...",
  "category": "..."
}

If URL is an Amazon/Flipkart URL, infer product type from the URL slug and generate relevant product info. Only return valid JSON, nothing else.`;

    const result = await kieChat([{ role: 'user', content: extractionPrompt }]);

    let productData: ProductData;
    try {
      // Extract JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      productData = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback minimal structure
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

    return NextResponse.json({ success: true, data: productData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
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

  // Wait for run to finish
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
