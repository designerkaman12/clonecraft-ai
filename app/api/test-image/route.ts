import { NextRequest, NextResponse } from 'next/server';

const KIE_BASE = (process.env.KIE_API_BASE_URL || 'https://api.kie.ai').replace(/\/$/, '');
const KIE_KEY  = process.env.KIE_API_KEY || '';

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');

  if (!taskId) {
    // Start a new test generation using Flux-2 Market API
    const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KIE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'flux-2/flex-text-to-image',
        input: {
          prompt: 'A shiny red apple on a clean white background, professional product photography, studio lighting',
          aspect_ratio: '1:1',
          resolution: '1K',
          nsfw_checker: false,
        },
      }),
    });
    const data = await res.json();
    return NextResponse.json({ step: 'started', raw: data });
  }

  // Poll an existing task
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${KIE_KEY}` },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
