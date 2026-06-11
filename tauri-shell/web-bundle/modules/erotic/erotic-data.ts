// ============================================================
// DogeChat Engine — Erotic Module Data
// CANONICAL source for lust tier definitions, display config,
// and activation constants. Registered into the module constants
// bridge at startup for core access.
// ============================================================

// --- Module ID ---
export const EROTIC_MODULE_ID = 'erotic' as const;

// --- Lust Tier Definitions (canonical source) ---
export const LUST_TIERS = ['休眠', '萌芽', '悶燒', '燃燒', '貪婪'] as const;
export type LustTier = (typeof LUST_TIERS)[number];

export const LUST_TIER_COLORS: Record<LustTier, string> = {
  '休眠': '#4a4a5a',
  '萌芽': '#c47090',
  '悶燒': '#d05080',
  '燃燒': '#e03060',
  '貪婪': '#ff2060',
};

export const LUST_CSS_CLASS: Record<LustTier, string> = {
  '休眠': 'lust-dormant',
  '萌芽': 'lust-spark',
  '悶燒': 'lust-smolder',
  '燃燒': 'lust-burn',
  '貪婪': 'lust-ravenous',
};

export const LUST_ICON: Record<LustTier, string> = {
  '休眠': '○',
  '萌芽': '◐',
  '悶燒': '◑',
  '燃燒': '◕',
  '貪婪': '●',
};

export const LUST_PULSE_TIERS = new Set<LustTier>(['貪婪']);

// --- Erotic Milestone Behavioral Defaults ---
// Universal fallback directives for erotic interactions at each affection milestone.
// Injected when erotic module is active and the character has no overriding
// milestoneDirective at the same threshold. Character directives always take priority.
import type { MilestoneDirectiveKey } from '../../src/constants';

export const EROTIC_MILESTONE_DEFAULTS: Partial<Record<MilestoneDirectiveKey, string>> = {
  n90: '極度抗拒任何親密接觸，可能以暴力或恐懼回應',
  n50: '明確拒絕性暗示與身體接觸，會掙扎和抵抗',
  b30: '對調情和輕度肢體親密反應曖昧，不明確拒絕但也不主動',
  b50: '接受並享受口交、股間等直接性接觸；無保護插入仍有顧慮和猶豫',
  b70: '允許無保護性交但仍擔憂，開始主動但不過度地展現性慾與渴望',
  b90: '非常配合甚至主動提議無保護性交，高情慾時願嘗試極端玩法，性慾恆常且易被撩起',
  b100: '可被觸發為性愛沉溺狀態，感到安全與被渴望時會主動提出極端玩法',
};

// --- Erotic Activation Keywords ---
export const EROTIC_KEYWORDS: readonly string[] = L.EROTIC_KEYWORDS;

// --- Lust Erotic Threshold ---
/** Lust tier index threshold for erotic module injection (悶燒). */
export const LUST_EROTIC_THRESHOLD = LUST_TIERS.indexOf('悶燒');

// --- Registration Helper ---
// Called by initRegistry() to push erotic constants into the bridge.

import { L } from '../../src/locale/locale-provider';
import { registerModuleConstants, registerModuleTierOrder, registerModuleDisplayConfig } from '../../src/modules/registry';

export function registerEroticConstants(): void {
  registerModuleConstants(EROTIC_MODULE_ID, {
    MODULE_ID: EROTIC_MODULE_ID,
    LUST_TIERS,
    DEFAULT_TIER: LUST_TIERS[0],
    KEYWORDS: EROTIC_KEYWORDS,
    LUST_EROTIC_THRESHOLD,
    EROTIC_MILESTONE_DEFAULTS,
  });

  registerModuleTierOrder(EROTIC_MODULE_ID, 'lustTier', LUST_TIERS);

  registerModuleDisplayConfig(EROTIC_MODULE_ID, 'lustTier', {
    tiers: LUST_TIERS,
    colors: LUST_TIER_COLORS,
    cssClasses: LUST_CSS_CLASS,
    icons: LUST_ICON,
    pulseTiers: LUST_PULSE_TIERS,
  });
}
