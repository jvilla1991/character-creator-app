import { PC, PcItem } from '../models/pc';
import { modFromScore } from './character-math';

// ── Armor Class from equipped inventory ─────────────────────────────────────
// Catalog armorClass strings come in exactly four shapes (denormalized onto
// the inventory line at purchase): "11 + Dex modifier" (light),
// "14 + Dex modifier (max 2)" (medium), "17" (heavy, fixed), "+2" (shield).

export interface ArmorFormula {
  base: number;
  dex: 'full' | 'max2' | 'none';
}

/** Parse a catalog armorClass string; null for shields and unparseable text. */
export function parseArmorClass(str: string | undefined): ArmorFormula | null {
  if (!str || str.trim().startsWith('+')) return null; // shield or empty
  const base = parseInt(str, 10);
  if (isNaN(base)) return null;
  if (/max\s*2/i.test(str)) return { base, dex: 'max2' };
  if (/dex/i.test(str)) return { base, dex: 'full' };
  return { base, dex: 'none' };
}

/** A shield line's flat bonus ("+2" → 2); 0 for anything else. */
export function shieldBonus(str: string | undefined): number {
  if (!str || !str.trim().startsWith('+')) return 0;
  const bonus = parseInt(str, 10);
  return isNaN(bonus) ? 0 : bonus;
}

/** Equipped, still-owned armor-category lines that carry a catalog formula. */
function equippedArmorLines(pc: PC): PcItem[] {
  return (pc.inventory ?? []).filter(i =>
    i.category === 'armor' && i.equipped && i.status !== 'dropped' && !!i.armorClass);
}

/**
 * AC from what's equipped: the highest-base equipped armor (+Dex per its
 * bounds) plus every equipped shield's bonus; with no armor equipped,
 * unarmored 10 + Dex. (Class features like Unarmored Defense aren't modeled —
 * the AC field on the sheet stays hand-editable for those tables.)
 */
export function computeAc(pc: PC): number {
  const dexMod = modFromScore(pc.stats?.DEX ?? 10);
  const lines = equippedArmorLines(pc);

  const armors = lines
    .map(i => parseArmorClass(i.armorClass))
    .filter((f): f is ArmorFormula => f !== null)
    .sort((a, b) => b.base - a.base);
  const shields = lines.reduce((sum, i) => sum + shieldBonus(i.armorClass), 0);

  if (armors.length === 0) return 10 + dexMod + shields;
  const best = armors[0];
  const dex = best.dex === 'full' ? dexMod : best.dex === 'max2' ? Math.min(2, dexMod) : 0;
  return best.base + dex + shields;
}

/**
 * Recompute AC only when the equipped-armor picture actually changed between
 * two inventories — leaves hand-set AC alone for unrelated inventory edits
 * (qty changes, non-armor drops, notes).
 */
export function withRecomputedAc(pc: PC, previousInventory: PcItem[] | undefined): PC {
  const before = armorSignature({ ...pc, inventory: previousInventory } as PC);
  const after = armorSignature(pc);
  if (before === after) return pc;
  return { ...pc, ac: computeAc(pc) };
}

function armorSignature(pc: PC): string {
  return equippedArmorLines(pc)
    .map(i => i.armorClass)
    .sort()
    .join('|');
}
