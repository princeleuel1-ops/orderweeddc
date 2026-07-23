/**
 * Gemini provider adapter — the default image backend.
 *
 * Why Gemini first (research, 2026-04): best product/brand consistency
 * across scene variants (each ad features a different product, so the
 * product must stay recognizable), best conversational refinement, and
 * the cheapest cost per variant ($0.039/image, $0.0195 batched) — an
 * order of magnitude under GPT Image 2's usable-variant cost. It also
 * sits inside the Google ecosystem the directory competes in.
 *
 * The adapter reads GEMINI_API_KEY from the environment at construction
 * time (injected via skill credentials in production — never hardcoded,
 * never logged). Tests inject a fake fetch; no test touches the network.
 */
import { createProvider } from '../provider-contract.mjs';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
const DEFAULT_VISION_MODEL = 'gemini-3-flash';

function requireApiKey(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Provide it via the ad-creative ' +
        'skill credentials (environment variable), never in source or chat.',
    );
  }
  return apiKey;
}

async function postJson(fetchImpl, url, body) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Gemini API request failed: ${response.status} ${detail.slice(0, 300)}`,
    );
  }
  return response.json();
}

function firstPart(payload, predicate) {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  return parts.find(predicate) ?? null;
}

/**
 * @param {{ apiKey?: string, imageModel?: string, visionModel?: string, fetchImpl?: typeof fetch }} [options]
 */
export function createGeminiProvider(options = {}) {
  const apiKey = requireApiKey(options.apiKey ?? process.env.GEMINI_API_KEY);
  const imageModel = options.imageModel ?? DEFAULT_IMAGE_MODEL;
  const visionModel = options.visionModel ?? DEFAULT_VISION_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return createProvider({
    name: 'gemini',
    model: imageModel,

    async generateImage({ prompt, aspectRatio = '1:1', referenceImages = [] }) {
      if (typeof prompt !== 'string' || prompt.length === 0) {
        throw new TypeError('generateImage requires a non-empty prompt');
      }
      const parts = [{ text: prompt }];
      for (const ref of referenceImages) {
        parts.push({
          inlineData: { mimeType: ref.mimeType, data: ref.imageBase64 },
        });
      }
      const payload = await postJson(
        fetchImpl,
        `${API_ROOT}/${imageModel}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio },
          },
        },
      );
      const image = firstPart(payload, (part) => part.inlineData?.data);
      if (!image) {
        throw new Error('Gemini returned no image data for the brief');
      }
      return {
        imageBase64: image.inlineData.data,
        mimeType: image.inlineData.mimeType ?? 'image/png',
        receipt: {
          provider: 'gemini',
          model: imageModel,
          aspectRatio,
          referenceImageCount: referenceImages.length,
          generatedAt: new Date().toISOString(),
        },
      };
    },

    async analyzeImage({ imageBase64, mimeType, instruction }) {
      if (typeof instruction !== 'string' || instruction.length === 0) {
        throw new TypeError('analyzeImage requires a non-empty instruction');
      }
      const payload = await postJson(
        fetchImpl,
        `${API_ROOT}/${visionModel}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: instruction },
                { inlineData: { mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json' },
        },
      );
      const text = firstPart(payload, (part) => typeof part.text === 'string');
      if (!text) {
        throw new Error('Gemini returned no analysis for the image');
      }
      let parsed;
      try {
        parsed = JSON.parse(text.text);
      } catch {
        throw new Error('Gemini analysis was not valid JSON; refusing to guess');
      }
      return {
        ...parsed,
        receipt: {
          provider: 'gemini',
          model: visionModel,
          analyzedAt: new Date().toISOString(),
        },
      };
    },
  });
}
