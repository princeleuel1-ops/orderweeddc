// CANA × ORDERWEEDDC SOVEREIGN VISUAL SYSTEM SDK
// Canonical Visual Intelligence Integration for Next.js 14+ App Router
import canonicalRegistry from './registry.json';

export interface VisualChampion {
  candidate_id: string;
  asset_url: string;
  alt_text: string;
  mechanism: string;
  aspect_ratio: string;
  generation_mode: 'LIVE_PROVIDER' | 'CURATED_FALLBACK' | 'EMERGENCY_FALLBACK' | 'SIMULATION';
  promoted_at: string;
}

export interface VisualSlotDefinition {
  slot_id: string;
  route: string;
  component: string;
  role: string;
  mechanism: string;
  contract_id: string;
  current_champion: VisualChampion;
  previous_champion: VisualChampion | null;
  fallback_asset: string;
  fallback_class: 'CURATED_FALLBACK' | 'EMERGENCY_FALLBACK' | 'PRODUCTION_CHAMPION';
  deployment_state: 'CHAMPION' | 'CANARY' | 'ROLLED_BACK' | 'FALLBACK';
  performance_budget_kb: number;
}

export interface VisualAssetPayload {
  slot_id: string;
  asset_url: string;
  alt_text: string;
  aspect_ratio: string;
  blur_placeholder?: string;
  theme_mode: 'DAY_LIMESTONE' | 'NIGHT_OBSIDIAN' | 'ADAPTIVE';
  status: 'CHAMPION' | 'CANARY' | 'FALLBACK';
  mechanism: string;
  contract_id: string;
  generation_mode: string;
}

export class VisualSystemClient {
  private static registry = canonicalRegistry.slots as Record<string, VisualSlotDefinition>;

  public static getSlotDefinition(slot_id: string): VisualSlotDefinition | null {
    return this.registry[slot_id] || null;
  }

  public static getAllSlots(): VisualSlotDefinition[] {
    return Object.values(this.registry);
  }

  public static resolveSlot(
    slot_id: string,
    theme: 'DAY_LIMESTONE' | 'NIGHT_OBSIDIAN' = 'NIGHT_OBSIDIAN'
  ): VisualAssetPayload {
    const slotDef = this.registry[slot_id];

    if (!slotDef) {
      // Safe fallback to home hero definition
      const fallbackDef = this.registry['visual://customer.home.hero.primary'];
      return {
        slot_id,
        asset_url: fallbackDef ? fallbackDef.fallback_asset : '/art/hero_monument_flower.webp',
        alt_text: 'ORDERWEEDDC Sovereign Visual Intelligence Asset',
        aspect_ratio: '16/9',
        theme_mode: theme,
        status: 'FALLBACK',
        mechanism: 'OW_MECH_MONUMENT_CRAFT_FLOWER',
        contract_id: 'CONTRACT_FALLBACK_DEFAULT',
        generation_mode: 'EMERGENCY_FALLBACK'
      };
    }

    const activeAsset = slotDef.current_champion || {
      asset_url: slotDef.fallback_asset,
      alt_text: 'ORDERWEEDDC Visual Intelligence Asset',
      mechanism: slotDef.mechanism,
      aspect_ratio: '16/9',
      generation_mode: slotDef.fallback_class
    };

    return {
      slot_id: slotDef.slot_id,
      asset_url: activeAsset.asset_url,
      alt_text: activeAsset.alt_text,
      aspect_ratio: activeAsset.aspect_ratio || (slotDef.slot_id.includes('hero') ? '16/9' : '1/1'),
      theme_mode: theme,
      status: slotDef.deployment_state as 'CHAMPION' | 'CANARY' | 'FALLBACK',
      mechanism: slotDef.mechanism,
      contract_id: slotDef.contract_id,
      generation_mode: activeAsset.generation_mode
    };
  }
}
