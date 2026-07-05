import { PC, PcItem, PcSpell } from '../models/pc';

// ── Casting from the sheet ───────────────────────────────────────────────────
// Pure rules for spending spell slots and consuming material components.
// Mirrors the server-side SpellcastingRules so demo mode and out-of-session
// casts behave identically to the live-session endpoint.

/**
 * Catalog material texts spell out the cost ("a pearl worth 100+ GP"), so a
 * GP amount in the material text is the marker for a costly component — the
 * kind a table may require in inventory before the spell can be cast.
 */
const COSTLY_GP_PATTERN = /\d+\+?\s*GP/i;

/** The spell as stored on the PC, or undefined — casting always starts here. */
export function findSpell(pc: PC, spellName: string): PcSpell | undefined {
  return (pc.spells ?? []).find(s => s.name === spellName);
}

/**
 * Slot levels this spell can be cast at right now: the spell's own level and
 * every higher level the PC has slots for, with at least one slot free.
 * Cantrips need no slot — always [] (cast directly).
 */
export function castableLevels(pc: PC, spell: PcSpell): number[] {
  if (spell.lvl === 0) return [];
  return Object.keys(pc.spellSlots ?? {})
    .map(Number)
    .filter(lvl => lvl >= spell.lvl)
    .filter(lvl => {
      const slot = pc.spellSlots![lvl];
      return slot != null && slot.used < slot.max;
    })
    .sort((a, b) => a - b);
}

/**
 * The inventory line backing this spell's material component, if any — matched
 * by the spell NAME the shop stamped on the line at purchase time. Dropped and
 * empty lines don't count.
 */
export function findComponentLine(inventory: PcItem[] | undefined, spellName: string): PcItem | undefined {
  return (inventory ?? []).find(i =>
    i.category === 'material-component'
    && i.spell === spellName
    && i.status !== 'dropped'
    && (i.qty ?? 0) > 0);
}

/**
 * True when the spell calls for a component worth gold — an 'm' in its
 * components plus a GP amount in the material text. Un-enriched spells
 * (no components/material recorded) never need one.
 */
export function needsCostlyComponent(spell: PcSpell): boolean {
  return (spell.components ?? []).includes('m')
    && COSTLY_GP_PATTERN.test(spell.material ?? '');
}

/**
 * The warning to surface before casting without the required component, or
 * null when the cast is clean. In strict-components campaigns this same
 * condition blocks the cast instead.
 */
export function castWarning(pc: PC, spell: PcSpell): string | null {
  if (!needsCostlyComponent(spell)) return null;
  if (findComponentLine(pc.inventory, spell.name)) return null;
  return `Missing material component: ${spell.material}`;
}

/**
 * Apply a cast to a whole PC — the out-of-session (and demo) mirror of the
 * server's cast endpoint: spends a slot at `atLevel` (nothing for cantrips)
 * and decrements a consumed-on-cast component line (removed at zero; a
 * reusable component is only required present, never spent). Returns a new
 * PC; the input is untouched. Throws when the spell is unknown or no slot at
 * `atLevel` is free — callers gate the UI with castableLevels first.
 */
export function applyCastToPc(pc: PC, spellName: string, atLevel: number): PC {
  const spell = findSpell(pc, spellName);
  if (!spell) throw new Error(`Unknown spell: ${spellName}`);

  let spellSlots = pc.spellSlots;
  if (spell.lvl > 0) {
    const slot = pc.spellSlots?.[atLevel];
    if (atLevel < spell.lvl || !slot || slot.used >= slot.max) {
      throw new Error(`No level ${atLevel} slot available`);
    }
    spellSlots = { ...pc.spellSlots, [atLevel]: { ...slot, used: slot.used + 1 } };
  }

  return { ...pc, spellSlots, inventory: consumeComponent(pc.inventory, spell.name) };
}

/**
 * Spend one unit of the spell's consumed-on-cast component line, removing the
 * line at zero. A reusable line (consumedOnCast falsy) or no line at all
 * leaves the inventory untouched.
 */
function consumeComponent(inventory: PC['inventory'], spellName: string): PC['inventory'] {
  const line = findComponentLine(inventory, spellName);
  if (!line || line.consumedOnCast !== true) return inventory;
  const items = (inventory ?? []).map(i => ({ ...i }));
  const match = items.find(i =>
    i.category === 'material-component' && i.spell === spellName
    && i.status !== 'dropped' && (i.qty ?? 0) > 0)!;
  if (match.qty === 1) return items.filter(i => i !== match);
  match.qty -= 1;
  return items;
}

/** A long rest restores every spell slot (used back to 0); max is untouched. */
export function applyLongRestToSlots(spellSlots: PC['spellSlots']): PC['spellSlots'] {
  if (!spellSlots) return spellSlots;
  const out: NonNullable<PC['spellSlots']> = {};
  for (const lvl of Object.keys(spellSlots).map(Number)) {
    out[lvl] = { ...spellSlots[lvl], used: 0 };
  }
  return out;
}
