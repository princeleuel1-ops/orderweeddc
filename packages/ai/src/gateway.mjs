import { createHash } from 'node:crypto';

export const LOCAL_QUALITY_STAGE_REGISTRY = Object.freeze([
  { id: 1, name: 'tests', purpose: 'Behavior and regression tests' },
  { id: 2, name: 'lint', purpose: 'Static code-quality checks' },
  { id: 3, name: 'typecheck', purpose: 'TypeScript validation' },
  { id: 4, name: 'build', purpose: 'Production compilation' },
]);

export const LEGACY_EXTERNAL_GATEWAY_STATUS = Object.freeze({
  enabled: false,
  reason: 'External model execution is removed from the CANA product runtime.',
});

function promptReceipt(prompt) {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 12);
}

/**
 * Compatibility guard for the removed external-model client path.
 */
export function getNextClient() {
  throw new Error(
    'The legacy direct model client is disabled. CANA runs direct local quality checks.',
  );
}

/**
 * Deterministic local substitute for callers that previously fanned prompts
 * directly across environment credentials. It never reads credentials, calls
 * a provider, writes generated content, or claims external verification.
 */
export async function executeParallelPrompts(
  prompts,
  executionLabel = 'local/deterministic',
) {
  if (!Array.isArray(prompts)) {
    throw new TypeError('prompts must be an array');
  }

  return prompts.map((prompt, index) => {
    const stage =
      LOCAL_QUALITY_STAGE_REGISTRY[index % LOCAL_QUALITY_STAGE_REGISTRY.length];
    return JSON.stringify({
      mode: 'LOCAL_DETERMINISTIC',
      executionLabel,
      stage: stage.id,
      stageName: stage.name,
      promptReceipt: promptReceipt(String(prompt)),
      externalModelExecution: false,
      externallyVerified: false,
      message: 'No external model call or factual verification was performed.',
    });
  });
}

export function getLocalQualityStageRegistry() {
  return LOCAL_QUALITY_STAGE_REGISTRY.map((stage) => ({ ...stage }));
}
