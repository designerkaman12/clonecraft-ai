import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const key = process.env.KIE_API_KEY;
  return NextResponse.json({
    status: 'ok',
    app: 'CloneCraft AI',
    version: '1.0.0',
    apiKeyConfigured: !!key,
    timestamp: new Date().toISOString(),
  });
}
