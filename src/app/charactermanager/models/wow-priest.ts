import type { FeatureCard, FeatureCardInput, FeatureCardRow } from './hero-class';
import type { PC } from './pc';
import { modFromScore, spellAttackBonus } from '../utils/character-math';

/**
 * The World of Warcraft Priest (Cleric)'s sheet cards — one for each WoW-only
 * domain (Discipline, Shadow) from Cleric level 3. Computed from the character,
 * never persisted; the feature text itself comes from the server, so the cards
 * are short paraphrases with the numbers worked out. The priest's class-variant
 * entry lives in {@link ./wow-class-variants}.
 */

/** The WoW-only cleric domains — the server offers them to WoW clerics only. */
export const DISCIPLINE_DOMAIN = 'Discipline Domain';
export const SHADOW_DOMAIN = 'Shadow Domain';

function sameName(a: string | null | undefined, b: string): boolean {
  return (a ?? '').toLowerCase() === b.toLowerCase();
}

function wisMod(input: FeatureCardInput): number {
  return modFromScore(input.stats?.WIS ?? 10);
}

/** The Cleric spell attack bonus (proficiency + WIS), from the shared spell math. */
export function priestSpellAttack(input: FeatureCardInput): number {
  const pc = { clazz: 'Cleric', level: input.level, prof: input.prof ?? undefined, stats: input.stats } as PC;
  return spellAttackBonus(pc) ?? 0;
}

/** Luminous Barrier's Temporary Hit Points: Cleric level + WIS modifier (at least 1). */
export function luminousBarrierHp(input: FeatureCardInput): number {
  return Math.max(1, input.level + wisMod(input));
}

/** Devouring Plague uses per Long Rest: the WIS modifier, at least 1. */
export function devouringPlagueUses(input: FeatureCardInput): number {
  return Math.max(1, wisMod(input));
}

// ── Discipline Domain ────────────────────────────────────────────────────────

export function disciplineDomainCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 3 || !sameName(input.subclass, DISCIPLINE_DOMAIN)) return null;
  const wis = wisMod(input);
  const attack = priestSpellAttack(input);
  const rows: FeatureCardRow[] = [
    {
      name: 'Holy Bolt',
      kind: 'Bonus Action · Channel Divinity',
      text: `Spell attack (${fmtBonus(attack)}) with a bolt of Light: ${dice('2d10', wis)} Radiant damage on a hit. `
        + `One creature of your choice within 60 ft. regains ${dice('1d10', wis)} HP.`,
    },
    {
      name: 'Atonement',
      text: 'A blessed creature stays blessed until the end of your next turn. Whenever you deal damage with a spell '
        + "that uses a spell slot, each blessed creature regains HP equal to the slot's level.",
    },
  ];
  const stats = [{ label: 'Spell attack', value: fmtBonus(attack) }];
  if (input.level >= 6) {
    const hp = luminousBarrierHp(input);
    rows.push({
      name: 'Luminous Barrier',
      kind: 'Cleric 6',
      text: `Grant ${hp} Temporary Hit Points (Cleric level + Wisdom modifier). While they last, the creature `
        + 'has Resistance to all damage.',
    });
    stats.push({ label: 'Barrier', value: `${hp} Temp HP` });
  }
  if (input.level >= 17) {
    rows.push({
      name: 'Ultimate Penitence',
      kind: 'Cleric 17',
      text: 'Rise on the Light with Ascending Step or Ascending Volley — your domain features have the details.',
    });
  }
  return {
    name: 'Discipline Domain',
    source: `${DISCIPLINE_DOMAIN} 3`,
    summary: 'Balance Light and Shadow: smite a foe and mend an ally in the same breath.',
    stats,
    rows,
  };
}

// ── Shadow Domain ────────────────────────────────────────────────────────────

export function shadowDomainCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 3 || !sameName(input.subclass, SHADOW_DOMAIN)) return null;
  const uses = devouringPlagueUses(input);
  const rows: FeatureCardRow[] = [
    {
      name: 'Shadowform',
      kind: 'Bonus Action · Channel Divinity · 1 minute',
      text: 'Wrap yourself in shadow. You gain Shadow Stealth, and Void Empowerment adds an extra 1d6. '
        + 'It ends early if you dismiss it, have the Incapacitated condition, or deal Radiant damage with a spell.',
    },
    {
      name: 'Devouring Plague',
      kind: `${uses} per Long Rest`,
      text: 'Deal 1d10 Necrotic damage to a creature and regain that many Hit Points. '
        + 'Uses equal your Wisdom modifier (at least 1).',
    },
  ];
  if (input.level >= 6) {
    const hitDice = Math.floor(input.level / 2);
    rows.push({
      name: 'Dispersion',
      kind: 'Reaction · Cleric 6',
      text: "Dissolve into shadow: you have Resistance to all damage and a Fly Speed of 40 ft., but you can't take "
        + `actions. When it ends, you can spend up to ${hitDice} Hit Dice (half your total) to heal. `
        + 'Once per Short or Long Rest.',
    });
  }
  if (input.level >= 17) {
    rows.push({
      name: 'Vampiric Embrace',
      kind: 'Cleric 17',
      text: "When you roll Void Empowerment's 1d6, a creature of your choice within 30 ft. regains HP equal to the roll.",
    });
  }
  return {
    name: 'Shadow Domain',
    source: `${SHADOW_DOMAIN} 3`,
    summary: 'Embrace the Void to wither flesh and feed on the life of your foes.',
    stats: [{ label: 'Devouring Plague', value: `${uses} / Long Rest` }],
    rows,
  };
}

/** Every card a WoW cleric's sheet shows at this level and domain, in panel order. */
export function priestFeatureCards(input: FeatureCardInput): FeatureCard[] {
  return [disciplineDomainCard(input), shadowDomainCard(input)].filter((card): card is FeatureCard => !!card);
}

/** "2d10 + 3" / "2d10 − 1" / "2d10" — a damage or healing roll plus a modifier. */
function dice(base: string, mod: number): string {
  if (mod === 0) return base;
  return mod > 0 ? `${base} + ${mod}` : `${base} − ${Math.abs(mod)}`;
}

/** "+5" / "−1" for a bonus. */
function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}
