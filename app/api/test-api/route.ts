import { NextRequest, NextResponse } from 'next/server';
import { kieChat } from '@/lib/kieClient';

// Quick API connectivity test — verifies chat + key
export async function GET(req: NextRequest) {
  const key = process.env.KIE_API_KEY;
  if (!key) {
    return NextResponse.json({ success: false, error: 'KIE_API_KEY not set in .env.local' });
  }

  try {
    const reply = await kieChat([
      { role: 'user', content: 'Reply with exactly the JSON: {"status":"ok"}' }
    ]);
    let parsed: any = {};
    try { parsed = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch {}
    return NextResponse.json({
      success: true,
      apiKeyPrefix: key.substring(0, 8) + '...',
      chatTest: { raw: reply.substring(0, 100), parsed },
      endpoints: {
        imageGenerate: 'POST https://api.kie.ai/api/v1/gpt4o-image/generate',
        imagePoll:     'GET  https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=',
        chat:          'POST https://api.kie.ai/gpt-5-2/v1/chat/completions',
        marketTask:    'POST https://api.kie.ai/api/v1/market/task',
      }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
