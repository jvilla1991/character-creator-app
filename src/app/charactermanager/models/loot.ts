/**
 * Post-combat loot types — client mirror of the backend LootView / LootItemView /
 * ClaimResult DTOs, plus the paste-JSON import payload for curated encounter
 * loot. Coin amounts are in copper; reuse formatCp from shop.ts to render.
 */

import { Encounter } from './encounter';
import { PcItem } from './pc';

export interface LootItem {
  id: number;
  catalogItemKey: string | null; // null for custom (free-hand) items
  name: string;                  // resolved: catalog name or custom name
  custom: boolean;
  customNotes: string | null;
  qty: number;
  qtyRemaining: number;          // what's left to claim (first-come-first-served)
}

export interface LootView {
  id: number;
  sessionId: number;
  name: string | null;           // drop label, e.g. the seeding encounter's name
  dropped: boolean;              // false = DM draft, true = players may claim
  coinCpTotal: number;
  coinCpRemaining: number;
  items: LootItem[];
}

/** Outcome of a claim: the character's new purse + inventory, and the refreshed pool. */
export interface ClaimResult {
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  inventory: PcItem[];
  loot: LootView;
}

/**
 * Curated-encounter loot as pasted/shared JSON. Each line is either a catalog
 * reference ("key", an SRD slug) or a custom free-hand item ("name" + optional
 * "notes") — exactly one of the two; qty defaults to 1. coinGp (fractions
 * allowed) adds to the encounter's coin pile. Import APPENDS to existing loot.
 */
export interface LootImportPayload {
  coinGp?: number | null;
  items: Array<{ key?: string | null; name?: string | null; notes?: string | null; qty?: number | null }>;
}

/** Serialize an encounter's prepped loot into the import format (share/author by example). */
export function toLootImportPayload(encounter: Encounter): LootImportPayload {
  return {
    ...(encounter.lootCoinCp > 0 ? { coinGp: encounter.lootCoinCp / 100 } : {}),
    items: encounter.lootItems.map(i => ({
      ...(i.custom
        ? { name: i.name, ...(i.customNotes ? { notes: i.customNotes } : {}) }
        : { key: i.catalogItemKey }),
      ...(i.qty !== 1 ? { qty: i.qty } : {}),
    })),
  };
}

/**
 * Parse + shape-check pasted loot JSON before it goes anywhere. Returns the
 * payload or a human-readable error (catalog keys are validated server-side,
 * which rejects the whole import naming any unknown ones).
 */
export function parseLootImportPayload(raw: string): { payload?: LootImportPayload; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Not valid JSON — check for missing quotes, commas, or braces.' };
  }
  const obj = parsed as Partial<LootImportPayload>;
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) {
    return { error: 'The loot needs an "items" array (it may be empty).' };
  }
  if (obj.coinGp != null && (typeof obj.coinGp !== 'number' || obj.coinGp < 0)) {
    return { error: '"coinGp" must be a non-negative number when present.' };
  }
  for (const item of obj.items) {
    const hasKey = !!item && typeof item.key === 'string' && !!item.key.trim();
    const hasName = !!item && typeof item.name === 'string' && !!item.name.trim();
    if (hasKey === hasName) {
      return { error: 'Every item needs either a "key" (an SRD slug like "longsword") or a "name" (a custom item) — not both.' };
    }
    if (item.qty != null && (typeof item.qty !== 'number' || item.qty < 1)) {
      return { error: `"${(item.key || item.name || '').trim()}": qty must be a positive number when present.` };
    }
    if (item.notes != null && typeof item.notes !== 'string') {
      return { error: `"${(item.key || item.name || '').trim()}": notes must be a string when present.` };
    }
  }
  return {
    payload: {
      coinGp: obj.coinGp ?? null,
      items: obj.items.map(i => ({
        key: typeof i.key === 'string' && i.key.trim() ? i.key.trim() : null,
        name: typeof i.name === 'string' && i.name.trim() ? i.name.trim() : null,
        notes: typeof i.notes === 'string' && i.notes.trim() ? i.notes.trim() : null,
        qty: i.qty ?? null,
      })),
    },
  };
}
