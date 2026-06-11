// ============================================================
// DogeChat Engine — Exploration Module Data
// Module-specific constants for exploration: mystery phases,
// object states, display labels, and limits.
// ============================================================

import { L } from '../../src/locale/locale-provider';
import { registerModuleConstants } from '../../src/modules/registry';

// --- Module ID ---
export const EXPLORATION_MODULE_ID = 'exploration' as const;

// --- Mystery Phase Definitions ---

export const MYSTERY_PHASES = ['rumor', 'puzzle', 'revelation'] as const;
export type MysteryPhase = (typeof MYSTERY_PHASES)[number];

export const MYSTERY_PHASE_ICONS: Record<MysteryPhase, string> = {
  rumor: '💬',
  puzzle: '🔍',
  revelation: '✨',
};

export const MYSTERY_PHASE_LABELS: Record<MysteryPhase, string> = {
  rumor: L.MYSTERY_PHASE_RUMOR,
  puzzle: L.MYSTERY_PHASE_PUZZLE,
  revelation: L.MYSTERY_PHASE_REVELATION,
};

// --- Object State Labels ---

export const OBJECT_STATE_LABELS: Record<string, string> = {
  hidden: L.EXPLORATION_OBJECT_HIDDEN,
  discovered: L.EXPLORATION_OBJECT_DISCOVERED,
  collected: L.EXPLORATION_OBJECT_COLLECTED,
  used: L.EXPLORATION_OBJECT_USED,
};

// --- Limits ---

export const MAX_MYSTERIES_PER_SCENARIO = 3;
export const MAX_OBJECTS_PER_LOCATION = 2;

// --- Mystery State Types ---

export interface MysteryStep {
  location: string;
  objectName: string;
  objectDescription: string;
  hint: string;
  portable: boolean;
  hidden: boolean;
  completed: boolean;
}

export interface MysteryState {
  id: string;
  title: string;
  phase: MysteryPhase;
  rumorText: string;
  puzzleText: string;
  revelationText?: string;
  steps: MysteryStep[];
  puzzleStartsAtStep: number;
  currentStep: number;
  relatedNpcs: string[];
  traitHints: {
    player?: string;
    npc?: string;
  };
  resolvedTurn?: number;
  activatedTurn: number;
}

// --- Chain Pattern Templates ---

export type LocationHint = 'any' | 'different' | 'same-as-previous';

export interface ChainStepTemplate {
  /** Should this object be portable (player picks it up)? */
  portable: boolean;
  /** Should this object start hidden (revealed by previous step)? */
  hidden: boolean;
  /** Location guidance for scenario authors. */
  locationHint: LocationHint;
}

export interface ChainPattern {
  id: string;
  /** Display name (Traditional Chinese). */
  label: string;
  /** Narrative description of the pattern. */
  description: string;
  /** Step templates defining the chain structure. */
  steps: readonly ChainStepTemplate[];
}

export const CHAIN_PATTERNS: readonly ChainPattern[] = [
  {
    id: 'fetch-activate',
    label: L.EXPLORATION_CHAIN_FETCH,
    description: L.EXPLORATION_CHAIN_FETCH_DESC,
    steps: [
      { portable: true,  hidden: false, locationHint: 'any' },
      { portable: false, hidden: false, locationHint: 'different' },
      { portable: true,  hidden: true,  locationHint: 'same-as-previous' },
    ],
  },
  {
    id: 'fetch-repair',
    label: L.EXPLORATION_CHAIN_REPAIR,
    description: L.EXPLORATION_CHAIN_REPAIR_DESC,
    steps: [
      { portable: true,  hidden: false, locationHint: 'any' },
      { portable: false, hidden: false, locationHint: 'different' },
    ],
  },
  {
    id: 'destroy-reveal',
    label: L.EXPLORATION_CHAIN_CLEAR,
    description: L.EXPLORATION_CHAIN_CLEAR_DESC,
    steps: [
      { portable: false, hidden: false, locationHint: 'any' },
      { portable: true,  hidden: true,  locationHint: 'same-as-previous' },
    ],
  },
  {
    id: 'three-clues',
    label: L.EXPLORATION_CHAIN_CONVERGE,
    description: L.EXPLORATION_CHAIN_CONVERGE_DESC,
    steps: [
      { portable: true,  hidden: false, locationHint: 'any' },
      { portable: true,  hidden: false, locationHint: 'different' },
      { portable: false, hidden: false, locationHint: 'different' },
    ],
  },
  {
    id: 'single-discovery',
    label: L.EXPLORATION_CHAIN_DIRECT,
    description: L.EXPLORATION_CHAIN_DIRECT_DESC,
    steps: [
      { portable: false, hidden: false, locationHint: 'any' },
      { portable: true,  hidden: true,  locationHint: 'same-as-previous' },
    ],
  },
];

/** Look up a chain pattern by ID. */
export function getChainPattern(id: string): ChainPattern | undefined {
  return CHAIN_PATTERNS.find(p => p.id === id);
}

// --- Scenario Data Shape ---

export interface ScenarioMysteryDef {
  title: string;
  /** Chain pattern ID used to generate this mystery (optional, for workshop reference). */
  chainPattern?: string;
  rumorText: string;
  puzzleText: string;
  steps: Array<{
    location: string;
    objectName: string;
    objectDescription: string;
    hint: string;
    portable: boolean;
    hidden: boolean;
  }>;
  puzzleStartsAtStep: number;
  relatedNpcs: string[];
  traitHints: { player?: string; npc?: string };
}

export interface ScenarioNotableObjectDef {
  name: string;
  location: string;
  description: string;
  portable: boolean;
}

// --- Registration ---

export function registerExplorationConstants(): void {
  registerModuleConstants(EXPLORATION_MODULE_ID, {
    MODULE_ID: EXPLORATION_MODULE_ID,
    MYSTERY_PHASES,
    MYSTERY_PHASE_ICONS,
    MYSTERY_PHASE_LABELS,
    OBJECT_STATE_LABELS,
    MAX_MYSTERIES_PER_SCENARIO,
    MAX_OBJECTS_PER_LOCATION,
    CHAIN_PATTERNS,
  });
}
