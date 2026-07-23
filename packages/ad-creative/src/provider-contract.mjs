/**
 * Provider contract for pluggable image-AI backends.
 *
 * Any model (Gemini, GPT Image, FLUX, a future model) participates by
 * satisfying this interface. The pipeline never imports a vendor SDK —
 * it only calls the two capabilities below, so swapping or A/B-ing
 * providers is a one-line change and never a rewrite.
 *
 * Research basis (2026-04 head-to-heads, docs/competitive/ad-creative-research.md):
 * - Gemini image stack: best product/brand consistency + cheapest per variant.
 * - GPT Image 2: best in-image typography + prompt adherence.
 * - Every model nets NEGATIVE typography sentiment => compliance text is
 *   never generated in-image; it is composed as a deterministic overlay.
 * - Failure modes diverge per model (Gemini hallucinates, GPT distorts)
 *   => post-generation verification is mandatory regardless of provider.
 */

/**
 * @typedef {object} GeneratedImage
 * @property {string} imageBase64 base64-encoded image bytes
 * @property {string} mimeType e.g. "image/png"
 * @property {object} receipt provider name, model, timestamp, request shape
 */

/**
 * @typedef {object} ImageAnalysis
 * @property {boolean} containsMinorsAppeal
 * @property {boolean} containsHealthClaims
 * @property {boolean} matchesBrand
 * @property {string} summary
 * @property {object} receipt
 */

const REQUIRED_METHODS = Object.freeze(['generateImage', 'analyzeImage']);

/**
 * Validate and freeze a provider implementation.
 * @param {{ name: string, model: string, generateImage: Function, analyzeImage: Function }} spec
 */
export function createProvider(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new TypeError('provider spec must be an object');
  }
  if (typeof spec.name !== 'string' || spec.name.length === 0) {
    throw new TypeError('provider.name must be a non-empty string');
  }
  if (typeof spec.model !== 'string' || spec.model.length === 0) {
    throw new TypeError('provider.model must be a non-empty string');
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof spec[method] !== 'function') {
      throw new TypeError(`provider.${method} must be a function`);
    }
  }
  return Object.freeze({
    name: spec.name,
    model: spec.model,
    generateImage: spec.generateImage,
    analyzeImage: spec.analyzeImage,
  });
}
