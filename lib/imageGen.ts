/**
 * generateImageWithPolling
 * 
 * Splits image generation into 2 short requests to avoid Render's 30s timeout:
 *   1. POST /api/generate-image          → { taskId }
 *   2. POST /api/generate-image?poll=1   → { done, imageUrl? } (repeated every 4s)
 */
export async function generateImageWithPolling(
  prompt: string,
  aspectRatio: string,
  slotId: string,
  onProgress?: (status: string, progress: string) => void,
  maxPolls = 45,   // 45 × 4s = 3 min max
  pollInterval = 4000
): Promise<string> {

  // Step 1: Start generation
  const startRes = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, slotId }),
  });

  const startData = await startRes.json();

  if (!startData.success || !startData.taskId) {
    throw new Error(startData.error || 'Failed to start image generation');
  }

  const { taskId } = startData;

  // Step 2: Poll until done
  for (let i = 0; i < maxPolls; i++) {
    await delay(pollInterval);

    const pollRes = await fetch('/api/generate-image?poll=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, slotId }),
    });

    const pollData = await pollRes.json();

    if (!pollData.success && pollData.done) {
      throw new Error(pollData.error || 'Image generation failed');
    }

    if (pollData.done && pollData.imageUrl) {
      return pollData.imageUrl;
    }

    // Still in progress
    onProgress?.(pollData.status ?? 'GENERATING', pollData.progress ?? String(i / maxPolls));
  }

  throw new Error('Image generation timed out after 3 minutes');
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
