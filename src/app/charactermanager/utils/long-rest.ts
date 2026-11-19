import { PC } from '../models/pc';
import { hitDieFor } from './character-math';
import { heroClassFor } from '../models/hero-class';
import { classResourceStates } from './class-resources';

/** One spell level's slots as a long rest will leave them. */
export interface LongRestSlotLine {
  level: number;
  max: number;
  /** Expended slots that come back. */
  back: number;
}

/**
 * What a long rest will restore for one hero (2024 PHB), worked out from the
 * sheet as it stands now. The server applies the same rules when the rest
 * finishes; this only feeds the screens that describe it beforehand.
 */
export interface LongRestPreview {
  /** At 0 Hit Points: the hero cannot begin a long rest and gains nothing. */
  cannotRest: boolean;
  hpNow: number;
  hpMax: number;
  hpGain: number;
  /** Temporary Hit Points that fade when the rest ends. */
  tempHp: number;
  hitDie: number;
  hitDiceTotal: number;
  hitDiceBack: number;
  exhaustionNow: number;
  exhaustionAfter: number;
  /** Spell levels the hero has slots for; empty for a non-caster. */
  slots: LongRestSlotLine[];
  /** Limited-use class features (Second Wind, Lay On Hands, ...) and how much of each comes back. */
  resources: LongRestResourceLine[];
}

/** One class resource as a long rest will leave it: full. */
export interface LongRestResourceLine {
  key: string;
  name: string;
  max: number;
  /** What the hero has left right now. */
  now: number;
  /** Uses or points that come back. */
  back: number;
}

export function longRestPreview(pc: PC): LongRestPreview {
  const hpNow = pc.hp?.cur ?? 0;
  const hpMax = pc.hp?.max ?? 0;
  const total = pc.level ?? 1;
  const exhaustionNow = pc.exhaustion ?? 0;
  const slots = Object.entries(pc.spellSlots ?? {})
    .map(([level, slot]) => ({ level: Number(level), max: slot.max, back: Math.min(slot.used, slot.max) }))
    .filter(s => s.max > 0)
    .sort((a, b) => a.level - b.level);
  return {
    cannotRest: pc.hp != null && hpNow <= 0,
    hpNow,
    hpMax,
    hpGain: Math.max(0, hpMax - hpNow),
    tempHp: pc.hp?.temp ?? 0,
    hitDie: hitDieFor(pc.clazz),
    hitDiceTotal: total,
    hitDiceBack: Math.min(pc.hitDiceUsed ?? 0, total),
    exhaustionNow,
    exhaustionAfter: Math.max(0, exhaustionNow - 1),
    slots,
    resources: classResourceStates(pc).map(r => ({
      key: r.key, name: r.name, max: r.max, now: r.remaining, back: r.used,
    })),
  };
}

/** "1st", "2nd", "3rd", "4th" … for spell levels. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * The class name the long rest screens show beside the level: the hero class's
 * short name ("Death Knight", "Demon Hunter", "Shaman") when the character is
 * one, otherwise the stored class. Shorter than `classDisplayName`, which adds
 * the base class in brackets — these lines sit in a narrow dialog and a list.
 */
export function longRestClassName(
  clazz: string | null | undefined, subclass?: string | null, specialization?: string | null,
): string {
  return heroClassFor({ clazz, subclass, specialization })?.name ?? clazz ?? '';
}
