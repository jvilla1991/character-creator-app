import { PC, PcItem } from '../models/pc';

// ── Legacy starting equipment → inventory lines ─────────────────────────────
// The creation wizard writes a character's starting kit to the two legacy
// arrays (`pc.weapons` / `pc.gear`) — that is the backend contract, and what
// the server-side slot conversion reads. Everything acquired later (bought,
// granted, looted) lands in the structured `pc.inventory`. These helpers map
// the legacy entries onto the same PcItem shape so the Inventory panel can
// list and manage both as one list. Pure mapping only: no catalog lookup and
// no bulk stamp (the slot conversion in slot-inventory.ts adds that on top).

/**
 * The PC's legacy weapons and gear as ad-hoc inventory lines — weapons first,
 * then gear, each a single unit. Builds NEW objects on every call (callers
 * that need stable identities must memoize) and never touches the input.
 */
export function legacyEquipmentLines(pc: PC): PcItem[] {
  const lines: PcItem[] = [];
  for (const weapon of pc.weapons ?? []) {
    lines.push({
      name: weapon.name,
      category: 'weapon',
      qty: 1,
      ...(weapon.dmg ? { damage: weapon.dmg } : {}),
      ...legacyNotes(weapon),
    });
  }
  for (const gear of pc.gear ?? []) {
    lines.push({
      name: gear.name,
      category: 'gear',
      qty: 1,
      ...(gear.equipped ? { equipped: true } : {}),
      ...legacyNotes(gear),
    });
  }
  return lines;
}

/**
 * Fold the legacy arrays into `pc.inventory` (appended after the existing
 * lines, which are copied) and clear them. Idempotent — a second run finds the
 * legacy arrays empty and adds nothing. Does not mutate the input PC.
 */
export function consolidateLegacyEquipment(pc: PC): PC {
  return {
    ...pc,
    inventory: [...(pc.inventory ?? []).map(i => ({ ...i })), ...legacyEquipmentLines(pc)],
    weapons: [],
    gear: [],
  };
}

/** The legacy `magic` flag has no PcItem field — it survives as a notes prefix. */
function legacyNotes(legacy: { magic?: boolean; notes?: string }): { notes?: string } {
  const base = (legacy.notes ?? '').trim();
  const notes = legacy.magic ? (base ? `magic · ${base}` : 'magic') : base;
  return notes ? { notes } : {};
}
