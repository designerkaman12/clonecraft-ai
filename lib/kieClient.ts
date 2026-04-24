// Gemini AI unified client — replaces kie.ai and OpenAI
// Chat:    POST /v1beta/models/gemini-2.5-flash:generateContent
// Images:  POST /v1beta/models/gemini-2.5-flash-image:generateContent (returns base64)

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ─── Chat / LLM via Gemini ───────────────────────────────────
// Primary: gemini-2.0-flash-001 (stable, fast, free)
// Fallback: gemini-2.5-flash (latest)
export async function kieChat(
  messages: { role: string; content: string | any[] }[],
  model = 'gemini-2.0-flash-001'
): Promise<string> {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured');

  // Convert OpenAI-style messages to Gemini format
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const tryModel = async (modelName: string): Promise<string> => {
    const res = await fetch(
      `${GEMINI_BASE}/models/${modelName}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini chat error ${res.status} (${modelName}): ${err}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  };

  // Try primary model, fall back to 2.5-flash if overloaded (503)
  try {
    return await tryModel(model);
  } catch (e: any) {
    if (e.message?.includes('503') || e.message?.includes('UNAVAILABLE') || e.message?.includes('overloaded')) {
      console.warn(`[kieChat] ${model} overloaded, falling back to gemini-2.5-flash`);
      return await tryModel('gemini-2.5-flash');
    }
    throw e;
  }
}

// ─── Image Generation via Gemini 2.5 Flash Image ────────────
// Returns a data URL: "data:image/png;base64,..."
export async function kieGenerateImage(
  prompt: string,
  aspectRatio = '1:1'
): Promise<string> {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured');

  const trimmedPrompt = prompt.trim().substring(0, 2000);

  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: trimmedPrompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini image error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

  if (!imgPart) throw new Error('No image returned from Gemini');

  const { mimeType, data: b64 } = imgPart.inlineData;
  return `data:${mimeType};base64,${b64}`;
}

// ─── Stubs for legacy kie.ai functions (kept for compatibility) ─

export async function poll4oTask(): Promise<string> {
  throw new Error('poll4oTask not used with Gemini backend.');
}

export async function kieRemoveBackground(imageUrl: string): Promise<string> {
  console.warn('[kieRemoveBackground] Not available with Gemini. Returning original.');
  return imageUrl;
}

export async function kieUpscaleImage(imageUrl: string): Promise<string> {
  console.warn('[kieUpscaleImage] Not available with Gemini. Returning original.');
  return imageUrl;
}

export async function kieMarketTask(model: string): Promise<string> {
  throw new Error(`kieMarketTask (${model}) not supported with Gemini backend.`);
}

export async function pollMarketTask(): Promise<string> {
  throw new Error('pollMarketTask not supported with Gemini backend.');
}

export const kieHeaders = () => ({
  'Content-Type': 'application/json',
});

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
