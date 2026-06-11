// ============================================================
// DogeChat Engine — Combat Module Data
// Module-specific constants for combat: rank archetypes,
// default HP ranges, intensity weights, consequence types.
// Core constants (COMBAT, COMBAT_INTENSITY, COMBAT_RANK_HP)
// live in src/constants.ts.
// ============================================================

// --- Module ID ---
export const COMBAT_MODULE_ID = 'combat' as const;

// --- Combat Activation Keywords ---
export const COMBAT_KEYWORDS: readonly string[] = L.COMBAT_KEYWORDS;

// --- Enemy Rank Labels ---
export const ENEMY_RANK_LABELS: Record<string, string> = {
  mob: L.ENEMY_RANK_MOB,
  elite: L.ENEMY_RANK_ELITE,
  boss: L.ENEMY_RANK_BOSS,
  swarm: L.ENEMY_RANK_SWARM,
};

// --- Enemy Rank Ability Counts ---
export const ENEMY_RANK_ABILITIES = {
  mob: 0,
  elite: 1,
  boss: 3,
  swarm: 0,
} as const;

// --- Combat Flags ---
export const COMBAT_FLAGS = {
  BOSS_FIGHT: 'boss_fight',
  SURROUNDED: 'surrounded',
} as const;

// --- Combat End Reasons ---
export const COMBAT_END_REASONS = [
  'victory',
  'player_knockout',
  'enemy_retreat',
  'player_retreat',
  'negotiated',
] as const;
export type CombatEndReason = (typeof COMBAT_END_REASONS)[number];

// --- Critical Event Keys ---
export const COMBAT_CRITICAL_EVENTS = {
  FIRST_KILL: 'combat_first_kill',
  BOSS_DEFEATED: 'combat_boss_defeated',
  SURVIVED_SURROUNDED: 'combat_survived_surrounded',
  LEVEL_UP: 'combat_level_up',
} as const;

// --- Consequence Types ---
export const CONSEQUENCE_TYPES = [
  'npc_injured',
  'npc_killed',
  'item_lost',
  'story_setback',
] as const;
export type ConsequenceType = (typeof CONSEQUENCE_TYPES)[number];

// --- Combat Mechanical Constants (canonical source) ---
// Previously in src/constants.ts, now module-owned.

export const COMBAT_MECHANICS = {
  /** HP set after player knockout failsafe rescue. */
  KNOCKOUT_RECOVERY_HP: 1,
  /** Minimum cooldown turns for enemy abilities. */
  MIN_COOLDOWN: 1,
  /** XP awarded per enemy defeated. */
  XP_PER_DEFEAT: 1,
} as const;

/** Intensity score contributions from combat factors. */
export const COMBAT_INTENSITY = {
  BASE: 0,
  SURROUNDED: 2,
  BOSS: 2,
  IN_DANGER: 1,        // low HP OR ally down — no stacking
  CAP: 5,
  LOW_HP_THRESHOLD: 0.25,
} as const;

/** Enemy rank HP ranges (validation bounds). */
export const COMBAT_RANK_HP = {
  mob: { min: 1, max: 5 },
  swarm: { min: 5, max: 15 },
  elite: { min: 7, max: 20 },
  boss: { min: 20, max: 40 },
} as const;

/** Default HP per enemy rank (used when LLM omits HP). */
export const COMBAT_RANK_DEFAULT_HP: Record<string, number> = {
  mob: 3,
  swarm: 6,
  elite: 10,
  boss: 20,
};

/** Encounter composition limits. */
export const ENCOUNTER_LIMITS = {
  /** Hard cap on total enemy entities (after swarm merging). */
  MAX_ENEMIES: 5,
  MAX_MOBS: 4,
  MAX_ELITES: 3,
  MAX_ELITES_WITH_BOSS: 1,
  MAX_BOSSES: 1,
} as const;

// --- Severity-Based Composition Ratios ---
// Client distributes UA's enemyCount across ranks using these ratios.
// midTier covers both elite and swarm (they compete for the same slots).

export type SeverityTier = 'standard' | 'tough' | 'boss';

export interface SeverityRatios {
  boss: number;
  midTier: number;
  mob: number;
}

export const SEVERITY_RATIOS: Record<SeverityTier, SeverityRatios> = {
  standard: { boss: 0,    midTier: 0,    mob: 1   },
  tough:    { boss: 0,    midTier: 0.3,  mob: 0.7 },
  boss:     { boss: 0.2,  midTier: 0.2,  mob: 0.6 },
};

/** Per-severity max enemy count. UA is told these limits; client also enforces. */
export const SEVERITY_MAX_ENEMIES: Record<SeverityTier, number> = {
  standard: 4,
  tough: 4,
  boss: 5,
};

// --- Registration Helper ---
import { L } from '../../src/locale/locale-provider';
import type { Tendency } from '../../src/modules/tendency-system';
import { registerModuleConstants } from '../../src/modules/registry';

// --- Default Ally Tendency (fallback when Creative Ops fails) ---
export const DEFAULT_ALLY_TENDENCY: Tendency = { strike: 40, defend: 25, assist: 35 };

// --- Combat Pacing Countdown ---
// After combat ends, roll 2d6 + lastEnemyCount to determine turns before
// the client hints to UA that another combat encounter may occur.
// Counter only decrements when no event/module scene is active.

/** Roll the combat pacing countdown: 2d6 + enemyCount. */
export function rollCombatCountdown(enemyCount: number, rng: () => number = Math.random): number {
  const d1 = Math.floor(rng() * 6) + 1;
  const d2 = Math.floor(rng() * 6) + 1;
  return d1 + d2 + enemyCount;
}

// --- Rest Configuration ---
export const REST_CONFIG = {
  /** Number of time periods consumed by resting. */
  periods: 1,
  /** HP restore percentage (0-100). 100 = full restore. */
  restorePercent: 100,
} as const;

export function registerCombatConstants(): void {
  registerModuleConstants(COMBAT_MODULE_ID, {
    MODULE_ID: COMBAT_MODULE_ID,
    MECHANICS: COMBAT_MECHANICS,
    INTENSITY: COMBAT_INTENSITY,
    RANK_HP: COMBAT_RANK_HP,
    RANK_DEFAULT_HP: COMBAT_RANK_DEFAULT_HP,
    ENCOUNTER_LIMITS,
    RANK_LABELS: ENEMY_RANK_LABELS,
    SEVERITY_RATIOS,
    SEVERITY_MAX_ENEMIES,
    KEYWORDS: COMBAT_KEYWORDS,
    rollCombatCountdown,
  });
}
