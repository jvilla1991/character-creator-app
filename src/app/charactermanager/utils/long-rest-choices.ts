import { PC } from '../models/pc';
import { LongRestChoices } from '../models/session';
import { canChangeSpellsAtLongRest, preparedSpellNames, samePreparedList } from './spell-preparation';
import { bloodRuneTempHp, isRuneforger, meleeWeapons, runeWeaponOf } from './rune-weapon';

/**
 * What a player is choosing on their long rest screen, kept beside what the
 * hero came into the rest with. Plain data, held by the session screen so it
 * survives the poll redrawing the dialog every two seconds.
 */
export interface LongRestDraft {
  pcId: number;
  /** Prepared leveled spells as the rest began. */
  originalSpells: string[];
  /** Prepared leveled spells as chosen so far. */
  spells: string[];
  /** The weapon the rune was on as the rest began (null: none). */
  originalRune: string | null;
  /** The weapon chosen to carry the rune (null: not chosen). */
  rune: string | null;
}

/** True when this hero has anything to choose as a long rest ends. */
export function hasLongRestChoices(pc: PC): boolean {
  return canChangeSpellsAtLongRest(pc) || isRuneforger(pc);
}

/**
 * Start a draft from the hero's sheet. `pending` is what the server is already
 * holding for a hero who readied before a reload — the draft picks up there.
 */
export function startLongRestDraft(pc: PC, pending?: LongRestChoices | null): LongRestDraft {
  const originalSpells = preparedSpellNames(pc.spells);
  const originalRune = runeWeaponOf(pc);
  const known = new Set((pc.spells ?? []).map(s => s.name));
  const weapons = meleeWeapons(pc).map(w => w.name);
  const pendingRune = pending?.runeWeapon
    ? weapons.find(w => w.toLowerCase() === pending.runeWeapon!.toLowerCase()) ?? null
    : null;
  return {
    pcId: pc.id,
    originalSpells,
    spells: pending?.preparedSpells ? pending.preparedSpells.filter(n => known.has(n)) : [...originalSpells],
    originalRune,
    rune: pendingRune ?? originalRune,
  };
}

/** What to send with Ready: only the parts the player actually changed. */
export function draftChoices(draft: LongRestDraft | null): LongRestChoices {
  if (!draft) return {};
  const choices: LongRestChoices = {};
  if (!samePreparedList(draft.originalSpells, draft.spells)) choices.preparedSpells = [...draft.spells];
  if (draft.rune && draft.rune !== draft.originalRune) choices.runeWeapon = draft.rune;
  return choices;
}

/**
 * Why Ready is not available yet, or null when it is. A Death Knight who has
 * a melee weapon but has never inscribed one must pick the rune's weapon first.
 */
export function draftBlockedReason(pc: PC, draft: LongRestDraft | null): string | null {
  if (!draft || !isRuneforger(pc)) return null;
  return !draft.rune && meleeWeapons(pc).length > 0
    ? 'Choose the weapon that carries your rune first.'
    : null;
}

/** Temporary Hit Points the rest will leave this hero with (the Blood Rune's gift), given the draft. */
export function draftTempHp(pc: PC, draft: LongRestDraft | null): number {
  const inscribed = draft ? !!draft.rune : !!runeWeaponOf(pc);
  return bloodRuneTempHp(pc, inscribed);
}
