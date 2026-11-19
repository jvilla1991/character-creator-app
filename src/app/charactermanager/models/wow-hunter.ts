/**
 * World of Warcraft Hunter (Ranger) pets: the Pet Families table and the sheet
 * math built on it. A WoW hunter who takes the Beast Master subclass picks a pet
 * family (persisted as `petFamily`, the bare family name). The family decides
 * which Primal Companion stat block the pet uses (Beast of the Land / Sea / Sky,
 * from the Player's Handbook), its WoW specialization (Cunning / Ferocity /
 * Tenacity — used by the Beast Mastery spec's level-6 Pet Specialization) and a
 * weapon mastery property its Beast's Strike can use.
 *
 * Everything here is text and computed numbers for the sheet; nothing is
 * applied to the character automatically. Rules text is paraphrased.
 */

/** The Primal Companion stat block a family uses; a Serpent may be either of two. */
export type PetStatBlock = 'Land' | 'Sea' | 'Sky' | 'Land or Sea';

/** A pet family's WoW specialization (drives the Beast Mastery spec's Pet Specialization). */
export type PetSpecialization = 'Cunning' | 'Ferocity' | 'Tenacity';

/** The weapon mastery property a family lends to Beast's Strike. */
export type PetMastery = 'Cleave' | 'Graze' | 'Push' | 'Sap' | 'Slow' | 'Vex';

export interface PetFamily {
  /** The stored `petFamily` value, e.g. 'Courser', 'Mechanized Animal'. */
  name: string;
  statBlock: PetStatBlock;
  specialization: PetSpecialization;
  mastery: PetMastery;
  /** Unusual families (✦) need a special ability to tame, usually from a magical tome. */
  unusual: boolean;
  /** What the family covers when the name alone doesn't say (e.g. 'horses'). */
  descriptor?: string;
}

const fam = (
  name: string, statBlock: PetStatBlock, specialization: PetSpecialization, mastery: PetMastery,
  extra: { unusual?: boolean; descriptor?: string } = {},
): PetFamily => ({
  name, statBlock, specialization, mastery, unusual: !!extra.unusual,
  ...(extra.descriptor ? { descriptor: extra.descriptor } : {}),
});

/** The 47 pet families, alphabetical. */
export const HUNTER_PET_FAMILIES: readonly PetFamily[] = [
  fam('Basilisk', 'Land', 'Cunning', 'Slow'),
  fam('Bat', 'Sky', 'Ferocity', 'Vex'),
  fam('Bear', 'Land', 'Tenacity', 'Push'),
  fam('Beetle', 'Land', 'Tenacity', 'Sap'),
  fam('Bird of Prey', 'Sky', 'Cunning', 'Slow'),
  fam('Blood Beast', 'Sky', 'Tenacity', 'Slow', { unusual: true, descriptor: 'stirges' }),
  fam('Boar', 'Land', 'Cunning', 'Sap'),
  fam('Camel', 'Land', 'Cunning', 'Push'),
  fam('Carrion Bird', 'Sky', 'Ferocity', 'Cleave'),
  fam('Cat', 'Land', 'Ferocity', 'Graze'),
  fam('Courser', 'Land', 'Ferocity', 'Graze', { descriptor: 'horses' }),
  fam('Crab', 'Land', 'Tenacity', 'Slow'),
  fam('Crocolisk', 'Land', 'Ferocity', 'Slow'),
  fam('Direhorn', 'Land', 'Tenacity', 'Cleave', { unusual: true, descriptor: 'triceratops' }),
  fam('Dolphin', 'Sea', 'Tenacity', 'Vex'),
  fam('Dragonhawk', 'Sky', 'Tenacity', 'Graze'),
  fam('Feathermane', 'Sky', 'Tenacity', 'Graze', { unusual: true, descriptor: 'gryphons' }),
  fam('Fox', 'Land', 'Cunning', 'Graze'),
  fam('Frenzy', 'Sea', 'Ferocity', 'Cleave', { descriptor: 'piranha-like fish' }),
  fam('Gorilla', 'Land', 'Ferocity', 'Push'),
  fam('Gruffhorn', 'Land', 'Cunning', 'Push', { descriptor: 'goats' }),
  fam('Hopper', 'Land', 'Tenacity', 'Graze', { descriptor: 'frogs and toads' }),
  fam('Hound', 'Land', 'Cunning', 'Slow'),
  fam('Hydra', 'Land', 'Tenacity', 'Cleave'),
  fam('Hyena', 'Land', 'Cunning', 'Cleave'),
  fam('Lizard', 'Land', 'Tenacity', 'Cleave'),
  fam('Mammoth', 'Land', 'Tenacity', 'Slow'),
  fam('Mechanized Animal', 'Land', 'Cunning', 'Sap', { unusual: true }),
  fam('Monkey', 'Land', 'Cunning', 'Graze'),
  fam('Moth', 'Sky', 'Cunning', 'Vex'),
  fam('Oxen', 'Land', 'Tenacity', 'Push'),
  fam('Raptor', 'Land', 'Cunning', 'Cleave', { descriptor: 'allosaurus' }),
  fam('Ray', 'Sky', 'Ferocity', 'Vex'),
  fam('Riverbeast', 'Land', 'Tenacity', 'Cleave', { descriptor: 'hippos' }),
  fam('Rodent', 'Land', 'Cunning', 'Cleave'),
  fam('Scalehide', 'Land', 'Ferocity', 'Sap', { descriptor: 'ankylosaurus' }),
  fam('Scorpid', 'Land', 'Ferocity', 'Cleave'),
  fam('Serpent', 'Land or Sea', 'Cunning', 'Graze'),
  fam('Shark', 'Sea', 'Cunning', 'Graze'),
  fam('Spider', 'Land', 'Ferocity', 'Slow'),
  fam('Stag', 'Land', 'Tenacity', 'Vex'),
  fam('Tallstrider', 'Land', 'Ferocity', 'Slow', { descriptor: 'flightless birds' }),
  fam('Threshadon', 'Sea', 'Tenacity', 'Sap', { unusual: true, descriptor: 'plesiosaurs' }),
  fam('Turtle', 'Land', 'Tenacity', 'Sap'),
  fam('Wasp', 'Sky', 'Ferocity', 'Cleave'),
  fam('Waterfowl', 'Land', 'Tenacity', 'Vex'),
  fam('Wolf', 'Land', 'Ferocity', 'Slow'),
];

/** The subclass whose hunters keep a pet (Beast Mastery and Survival both recommend it). */
export const BEAST_MASTER = 'Beast Master';

/** The Ranger level the Beast Mastery spec gains Pet Specialization (in place of Roving). */
export const PET_SPECIALIZATION_LEVEL = 6;

/** A family by its stored name (case-insensitive); undefined for an unknown or empty value. */
export function petFamilyByName(name: string | null | undefined): PetFamily | undefined {
  const n = (name ?? '').trim().toLowerCase();
  return n ? HUNTER_PET_FAMILIES.find(f => f.name.toLowerCase() === n) : undefined;
}

/** "Courser (horses)" / "Blood Beast (stirges) ✦" — a family as the selector lists it. */
export function petFamilyLabel(family: PetFamily): string {
  const base = family.descriptor ? `${family.name} (${family.descriptor})` : family.name;
  return family.unusual ? `${base} ✦` : base;
}

/** The Hunter specializations that keep a pet. A Marksmanship hunter has none (same rule as the server). */
export const PET_SPECIALIZATIONS: readonly string[] = ['Beast Mastery', 'Survival'];

/**
 * True when a character keeps a hunter pet: a Ranger with the Beast Mastery or Survival
 * specialization and the Beast Master subclass (class and subclass case-insensitive).
 */
export function keepsHunterPet(
  pc: { clazz?: string | null; subclass?: string | null; specialization?: string | null } | null | undefined,
): boolean {
  return (pc?.clazz ?? '').toLowerCase() === 'ranger'
    && PET_SPECIALIZATIONS.includes(pc?.specialization ?? '')
    && (pc?.subclass ?? '').toLowerCase() === BEAST_MASTER.toLowerCase();
}

// ── Primal Companion stat blocks (Player's Handbook, paraphrased + computed) ──

/** What a stat card is computed from. */
export interface PetStatInput {
  /** Ranger level. */
  level: number;
  /** Wisdom modifier. */
  wisMod: number;
  /** Your spell attack modifier. */
  spellAttack: number;
  /** Your spell save DC. */
  spellDc: number;
}

/** One computed Primal Companion stat card (Beast of the Land / Sea / Sky). */
export interface PetStatCard {
  name: string;
  size: string;
  ac: number;
  hp: number;
  speed: string;
  /** "STR 14 · DEX 14 · CON 15 · INT 8 · WIS 14 · CHA 11" */
  abilities: string;
  /** Beast's Strike: "+5 to hit, reach 5 ft. Hit: 1d8 + 5 Bludgeoning, Piercing, or Slashing" */
  strike: string;
  /** The block's own trait (Charge, Amphibious + grapple, Flyby), paraphrased. */
  trait: { name: string; text: string };
}

const fmt = (n: number): string => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const plus = (n: number): string => (n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`);

/** The Beast of the Land, Sea or Sky card for a ranger at `input`. */
export function petStatCard(block: 'Land' | 'Sea' | 'Sky', input: PetStatInput): PetStatCard {
  const level = Math.max(1, input.level);
  const ac = 13 + input.wisMod;
  const hit = `${fmt(input.spellAttack)} to hit, reach 5 ft.`;
  if (block === 'Land') {
    return {
      name: 'Beast of the Land', size: 'Medium Beast', ac, hp: 5 + 5 * level, speed: '40 ft., Climb 40 ft.',
      abilities: 'STR 14 · DEX 14 · CON 15 · INT 8 · WIS 14 · CHA 11',
      strike: `${hit} Hit: 1d8 ${plus(2 + input.wisMod)} Bludgeoning, Piercing, or Slashing (chosen when you summon it).`,
      trait: {
        name: 'Charge',
        text: 'If it moves at least 20 feet straight toward a target right before hitting it with Beast\'s Strike, '
          + `the target takes an extra 1d6 damage of the same type, and a Large or smaller target makes a DC ${input.spellDc} `
          + 'Strength save or is knocked Prone.',
      },
    };
  }
  if (block === 'Sea') {
    return {
      name: 'Beast of the Sea', size: 'Medium Beast', ac, hp: 5 + 5 * level, speed: '5 ft., Swim 60 ft.',
      abilities: 'STR 14 · DEX 14 · CON 15 · INT 8 · WIS 14 · CHA 11',
      strike: `${hit} Hit: 1d6 ${plus(2 + input.wisMod)} Bludgeoning or Piercing, and the target is Grappled (escape DC ${input.spellDc}).`,
      trait: { name: 'Amphibious', text: 'It can breathe both air and water.' },
    };
  }
  return {
    name: 'Beast of the Sky', size: 'Small Beast', ac, hp: 4 + 4 * level, speed: '10 ft., Fly 60 ft.',
    abilities: 'STR 6 · DEX 16 · CON 13 · INT 8 · WIS 14 · CHA 11',
    strike: `${hit} Hit: 1d4 ${plus(3 + input.wisMod)} Slashing.`,
    trait: { name: 'Flyby', text: "It doesn't provoke Opportunity Attacks when it flies out of an enemy's reach." },
  };
}

/** The stat card(s) a family's pet uses — two for the Serpent (Land or Sea, chosen on summoning). */
export function petStatCards(family: PetFamily, input: PetStatInput): PetStatCard[] {
  if (family.statBlock === 'Land or Sea') return [petStatCard('Land', input), petStatCard('Sea', input)];
  return [petStatCard(family.statBlock, input)];
}

// ── Pet Specialization (Beast Mastery spec, Ranger 6+) ────────────────────────

/** The Beast Mastery spec's level-6 Pet Specialization for a family, with any computed numbers. */
export interface PetSpecializationView {
  specialization: PetSpecialization;
  text: string;
  /** The spell it lets you cast once per Long Rest. */
  spell: string;
  /** Tenacity only: the bonus to your Hit Point maximum and to the beast's. */
  hpBonus?: { you: number; beast: number };
}

/**
 * Tenacity's bonus to your Hit Point maximum: 6 at Ranger 6, plus 1 for each
 * Ranger level gained after that; 0 below level 6.
 */
export function tenacityHpBonus(level: number): number {
  return level >= PET_SPECIALIZATION_LEVEL ? 6 + (level - PET_SPECIALIZATION_LEVEL) : 0;
}

/** The Pet Specialization a family grants at Ranger `level`; null before Ranger 6. */
export function petSpecialization(family: PetFamily, level: number, wisMod: number): PetSpecializationView | null {
  if (level < PET_SPECIALIZATION_LEVEL) return null;
  switch (family.specialization) {
    case 'Cunning':
      return {
        specialization: 'Cunning', spell: 'Freedom of Movement',
        text: "Your Speed and your beast's each increase by 10 feet. You can cast Freedom of Movement once per Long Rest.",
      };
    case 'Ferocity':
      return {
        specialization: 'Ferocity', spell: 'Haste',
        text: `While you are Bloodied, each time your beast hits with Beast's Strike, you and it each regain ${Math.max(0, wisMod)} `
          + 'Hit Points (your Wisdom modifier). You can cast Haste once per Long Rest.',
      };
    case 'Tenacity': {
      const you = tenacityHpBonus(level);
      return {
        specialization: 'Tenacity', spell: 'Stoneskin', hpBonus: { you, beast: level },
        text: `Your Hit Point maximum increases by ${you} (6, plus 1 per Ranger level after 6), and your beast's by ${level} `
          + '(your Ranger level). You can cast Stoneskin once per Long Rest.',
      };
    }
  }
}

/** Sheet notes under the pet card. */
export const PET_UNUSUAL_NOTE =
  '✦ Unusual family: taming one takes a special ability, usually learned from a magical tome — check with your DM.';
export const PET_MASTERY_NOTE =
  "When you cast Primal Companion and after each Long Rest, you can count your pet's family as one of your Weapon "
  + "Mastery weapons, so its mastery property applies to Beast's Strike.";
export const PET_HP_NOTE = 'Hit Point bonuses are not applied automatically — add them to your sheet yourself.';
