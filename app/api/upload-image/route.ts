import { NextRequest, NextResponse } from 'next/server';

const KIE_UPLOAD_BASE = 'https://kieai.redpandaai.co';
const KIE_KEY = process.env.KIE_API_KEY || '';

/**
 * POST /api/upload-image
 * Body: { base64Data: "data:image/png;base64,..." , fileName: "product.png" }
 * Returns: { success: true, imageUrl: "https://tempfile.redpandaai.co/..." }
 */
export async function POST(req: NextRequest) {
  try {
    const { base64Data, fileName } = await req.json();

    if (!base64Data) {
      return NextResponse.json({ success: false, error: 'base64Data required' }, { status: 400 });
    }
    if (!KIE_KEY) {
      return NextResponse.json({ success: false, error: 'KIE_API_KEY not set' }, { status: 500 });
    }

    const res = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KIE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data,
        uploadPath: 'images/user-uploads',
        fileName: fileName || `product_${Date.now()}.png`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`kie upload failed (${res.status}): ${err.substring(0, 200)}`);
    }

    const data = await res.json();
    console.log('[upload-image] kie response:', JSON.stringify(data).substring(0, 200));

    if (!data.success && data.code !== 200) {
      throw new Error(`kie upload error: ${data.msg || JSON.stringify(data)}`);
    }

    const imageUrl = data?.data?.downloadUrl || data?.data?.fileUrl;
    if (!imageUrl) throw new Error('No image URL in upload response');

    return NextResponse.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error('[upload-image] error:', error?.message);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
