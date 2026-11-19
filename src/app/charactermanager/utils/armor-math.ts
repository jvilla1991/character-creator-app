import { PC, PcItem } from '../models/pc';
import {
  BreakdownLine, adjustmentSum, adjustmentsFor, countedSum, markRemoved, removedLabelsFor,
} from '../models/stat-adjustment';
import { modFromScore } from './character-math';

// ── Armor Class from equipped inventory ─────────────────────────────────────
// Catalog armorClass strings come in exactly four shapes (denormalized onto
// the inventory line at purchase): "11 + Dex modifier" (light),
// "14 + Dex modifier (max 2)" (medium), "17" (heavy, fixed), "+2" (shield).

export interface ArmorFormula {
  base: number;
  dex: 'full' | 'max2' | 'none';
}

// The line shape lives with the adjustment model; re-exported for older imports.
export type { BreakdownLine };

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
 * The lines the app can work out for AC from what's equipped: the highest-base
 * equipped armor, Dex per that armor's bounds, then every equipped shield; with
 * no armor equipped, unarmored 10 + Dex. Class features like Unarmored Defense
 * and species traits aren't modeled: the DM adds those as adjustment lines.
 * Every line is listed here, including one the DM removed: {@link computeAc}
 * is what leaves those out.
 */
export function acAutoLines(pc: PC): BreakdownLine[] {
  const dexMod = modFromScore(pc.stats?.DEX ?? 10);
  const equipped = equippedArmorLines(pc);

  const best = equipped
    .map(item => ({ item, formula: parseArmorClass(item.armorClass) }))
    .filter((a): a is { item: PcItem; formula: ArmorFormula } => a.formula !== null)
    .sort((a, b) => b.formula.base - a.formula.base)[0];

  const lines: BreakdownLine[] = [];
  if (!best) {
    lines.push({ label: 'Unarmored', value: 10 });
    lines.push({ label: 'Dexterity', value: dexMod });
  } else {
    lines.push({ label: best.item.name, value: best.formula.base });
    if (best.formula.dex === 'full') {
      lines.push({ label: 'Dexterity', value: dexMod });
    } else if (best.formula.dex === 'max2') {
      const capped = Math.min(2, dexMod);
      lines.push(capped < dexMod
        ? { label: 'Dexterity', value: capped, note: 'capped at +2 by medium armor' }
        : { label: 'Dexterity', value: capped });
    } else {
      lines.push({ label: 'Dexterity', value: 0, note: 'heavy armor adds none' });
    }
  }
  for (const item of equipped) {
    const bonus = shieldBonus(item.armorClass);
    if (bonus !== 0) lines.push({ label: item.name, value: bonus });
  }
  return lines;
}

/**
 * AC from what's equipped alone: the sum of {@link acAutoLines} without the
 * lines the DM removed, and without the adjustment lines.
 */
export function computeAc(pc: PC): number {
  return countedSum(markRemoved(acAutoLines(pc), removedLabelsFor(pc, 'ac')));
}

/**
 * Keep the saved AC in step with the equipped armor: when an inventory change
 * moves what the armor is worth, shift the saved total by exactly that much.
 * Everything else in the total rides along untouched: the DM's adjustment
 * lines, and any older hand-typed difference that has no line yet. Unrelated
 * inventory edits (qty changes, non-armor drops, notes) move nothing, and
 * neither does armor whose line the DM removed: it was not in the total.
 */
export function withRecomputedAc(pc: PC, previousInventory: PcItem[] | undefined): PC {
  const before = computeAc({ ...pc, inventory: previousInventory } as PC);
  const after = computeAc(pc);
  if (before === after) return pc;
  const adjustments = adjustmentSum(adjustmentsFor(pc, 'ac'));
  const saved = pc.ac ?? before + adjustments;
  return { ...pc, ac: saved + (after - before) };
}
