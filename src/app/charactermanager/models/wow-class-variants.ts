import type {
  HeroClassOption, HeroSpellRow, SpecializationGuidance, SubclassSpellRow, SuggestedSpellLevel,
} from './hero-class';
import { PATH_OF_THE_ELEMENTS, PATH_OF_THE_SPIRITUAL_GUARDIAN, shamanFeatureCards } from './wow-shaman';
import { DISCIPLINE_DOMAIN, SHADOW_DOMAIN, priestFeatureCards } from './wow-priest';
import { BATTLE_MASTER, warriorFeatureCards } from './wow-warrior';
import { BEAST_MASTER } from './wow-hunter';

/**
 * World of Warcraft class *variants*: an ordinary 2024 base class plus a WoW
 * specialization, with no fixed subclass — the subclass is chosen normally when
 * it comes due. Stored as the base class (`clazz`), `specialization: <spec>`
 * and `subclass` null until then, so a character without a specialization
 * stays a plain base-game character everywhere.
 *
 * Each variant is one {@link HeroClassOption} entry: its specializations, the
 * per-specialization guidance (recommended picks), suggested spells, and any
 * WoW-only subclasses (with their always-prepared spells, if they have any). Components read these fields and
 * never special-case a variant. Everything here is guidance — never something
 * the app grants or forces. Text is paraphrased.
 */

/**
 * A variant's class-list label, following the `[WoW class] ([Base class])` rule:
 * `Shaman (Barbarian)`, but just `Druid` when the WoW name equals the base name
 * (the World of Warcraft source tag tells that row apart from the base one).
 */
export function variantLabel(name: string, baseClass: string): string {
  return name.toLowerCase() === baseClass.toLowerCase() ? baseClass : `${name} (${baseClass})`;
}

// ── Druid ────────────────────────────────────────────────────────────────────

export const WOW_DRUID_SPECIALIZATIONS = ['Balance', 'Feral', 'Guardian', 'Restoration'] as const;

export const CIRCLE_OF_THE_MOON = 'Circle of the Moon';

const WILD_RESURGENCE_TIP =
  'From Druid level 5 (Wild Resurgence), trading a spell slot for an extra use of Wild Shape is often worth it.';

/** Per-specialization starting picks (class step box + spells-step highlights). */
export const WOW_DRUID_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Balance: {
    featureChoice: { feature: 'Primal Order', option: 'Magician' },
    cantrips: ['Druidcraft', 'Starry Wisp', 'Wrath'],
    level1Spells: ['Cure Wounds', 'Entangle', 'Moonfire', 'Thunderwave'],
    subclass: { name: 'Circle of the Stars', note: 'Starry Form can take the look of a moonkin.' },
    feats: ['Elemental Adept', 'War Caster'],
  },
  Feral: {
    featureChoice: { feature: 'Primal Order', option: 'Warden' },
    cantrips: ['Druidcraft', 'Poison Spray'],
    level1Spells: ['Cure Wounds', 'Entangle', 'Speak with Animals', 'Thunderwave'],
    subclass: { name: CIRCLE_OF_THE_MOON, note: 'Your Wild Shape can use Cat Form.' },
    feats: ['Skulker', 'Slasher', 'Speedy'],
    tip: WILD_RESURGENCE_TIP,
  },
  Guardian: {
    featureChoice: { feature: 'Primal Order', option: 'Warden' },
    cantrips: ['Druidcraft', 'Thorn Whip'],
    level1Spells: ['Entangle', 'Healing Word', 'Speak with Animals', 'Thunderwave'],
    subclass: { name: CIRCLE_OF_THE_MOON, note: 'Your Wild Shape can use Bear Form.' },
    feats: ['Durable', 'Sentinel', 'Slasher'],
    tip: WILD_RESURGENCE_TIP,
  },
  Restoration: {
    featureChoice: { feature: 'Primal Order', option: 'Magician' },
    cantrips: ['Druidcraft', 'Produce Flame', 'Spare the Dying'],
    level1Spells: ['Cure Wounds', 'Entangle', 'Goodberry', 'Healing Word'],
    subclass: { name: 'Circle of the Land' },
    feats: ['Chef', 'Healer', 'Inspiring Leader', 'War Caster'],
  },
};

/** Suggested (not always-prepared) spells per specialization, by spell level. */
export const WOW_DRUID_SUGGESTED_SPELLS: Readonly<Record<string, readonly SuggestedSpellLevel[]>> = {
  Balance: [
    { level: 2, spells: ['Barkskin', 'Moonbeam', 'Summon Beast'] },
    { level: 3, spells: ['Call Lightning', 'Daylight', 'Dispel Magic', 'Summon Fey'] },
    { level: 4, spells: ['Fount of Moonlight', 'Starfall'] },
    { level: 5, spells: ['Reincarnate', 'Scrying'] },
    { level: 6, spells: ['Conjure Fey', 'Sunbeam'] },
    { level: 7, spells: ['Fire Storm'] },
    { level: 8, spells: ['Sunburst'] },
    { level: 9, spells: ['Storm of Vengeance'] },
  ],
  Feral: [
    { level: 2, spells: ['Feral Prowl', 'Pass without Trace', 'Summon Beast'] },
    { level: 3, spells: ['Call Lightning', 'Conjure Animals'] },
    { level: 4, spells: ['Dominate Beast', 'Freedom of Movement'] },
    { level: 5, spells: ['Commune with Nature', 'Innervate'] },
    { level: 6, spells: ['Wind Walk'] },
    { level: 7, spells: ['Regenerate'] },
    { level: 8, spells: ['Animal Shapes'] },
    { level: 9, spells: ['Shapechange'] },
  ],
  Guardian: [
    { level: 2, spells: ['Aid', 'Barkskin', 'Roar of Ursoc'] },
    { level: 3, spells: ['Aura of Vitality', 'Call Lightning'] },
    { level: 4, spells: ['Grasping Vine', 'Stoneskin'] },
    { level: 5, spells: ['Commune with Nature', 'Innervate'] },
    { level: 6, spells: ['Wall of Thorns'] },
    { level: 7, spells: ['Regenerate'] },
    { level: 8, spells: ['Animal Shapes'] },
    { level: 9, spells: ['Shapechange'] },
  ],
  Restoration: [
    { level: 2, spells: ['Aid', 'Lesser Restoration', 'Protection from Poison'] },
    { level: 3, spells: ['Aura of Vitality', 'Regrowth', 'Revivify'] },
    { level: 4, spells: ['Divination', 'Freedom of Movement'] },
    { level: 5, spells: ['Greater Restoration', 'Mass Cure Wounds'] },
    { level: 6, spells: ['Heal', 'Tranquility'] },
    { level: 7, spells: ['Regenerate'] },
    { level: 8, spells: ['Tree of Life'] },
    { level: 9, spells: ['Foresight'] },
  ],
};

export const WOW_DRUID: HeroClassOption = {
  key: 'Druid (World of Warcraft)',
  label: variantLabel('Druid', 'Druid'),
  name: 'Druid',
  baseClass: 'Druid',
  source: 'World of Warcraft',
  blurb: 'A keeper of the balance of nature, trained by the Cenarion Circle to channel '
    + 'moon and sun, take the shapes of cat and bear, or mend the living.',
  subclassNote: 'Chosen as normal at Druid level 3',
  subclassTerm: 'circle',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Balance',     desc: 'A celestial caster who calls down moon and sun magic, at home in moonkin form.' },
    { name: 'Feral',       desc: 'A quick predator in cat form who tears into foes and leaves them bleeding.' },
    { name: 'Guardian',    desc: 'A huge bear-form protector who stands in front and soaks up harm.' },
    { name: 'Restoration', desc: 'A healer who coaxes growth from the land and mends their allies.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_DRUID_GUIDANCE,
  suggestedSpells: WOW_DRUID_SUGGESTED_SPELLS,
  renownNote: 'Taking the World of Warcraft Druid raises your Renown with the Cenarion Circle by 3 — ask your DM to record it.',
  beastForms: true,
};

// ── Evoker (Sorcerer) ────────────────────────────────────────────────────────

export const WOW_EVOKER_SPECIALIZATIONS = ['Augmentation', 'Devastation', 'Preservation'] as const;

/**
 * The Evoker's locked subclass. It is the ordinary base-game Draconic Sorcery, so
 * a sorcerer is an Evoker only with one of the Evoker specializations too.
 */
export const DRACONIC_SORCERY = 'Draconic Sorcery';

/**
 * Evoker Spells, always prepared, by Sorcerer level: the spells every evoker gets
 * plus the specialization's own (✦ WoW spells are flagged from the spell data).
 * The server adds the "Evoker Spells" feature at Sorcerer 3.
 */
export const WOW_EVOKER_SPELL_TABLE: readonly HeroSpellRow[] = [
  { classLevel: 3, all: ['Chromatic Orb', "Dragon's Breath"], bySpecialization: {
    Augmentation: ['Ebon Might', 'Eruption'], Devastation: ['Azure Strike', 'Scorching Ray'],
    Preservation: ['Dream Breath', 'Living Flame'] } },
  { classLevel: 5, all: ['Fly'], bySpecialization: {
    Augmentation: ['Blistering Scales'], Devastation: ['Fireball'], Preservation: ['Emerald Blossom'] } },
  { classLevel: 7, all: ['Arcane Eye'], bySpecialization: {
    Augmentation: ['Upheaval'], Devastation: ['Emberstorm'], Preservation: ['Time Dilation'] } },
  { classLevel: 9, all: ['Summon Dragon'], bySpecialization: {
    Augmentation: ['Breath of Eons'], Devastation: ['Shattering Star'], Preservation: ['Dream Flight'] } },
];

const DRACONIC = { name: DRACONIC_SORCERY } as const;

/**
 * Per-specialization picks (class step box + spells-step highlights + sheet panel).
 * The subclass is locked at creation, so the box shows no subclass row.
 */
export const WOW_EVOKER_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Augmentation: {
    cantrips: ['Elementalism', 'Light', 'Sorcerous Burst', 'Thunderclap'],
    extraPrepared: ['Arcane Vigor', 'Enhance Ability', 'Flaming Sphere', 'Ice Knife', 'Living Flame'],
    metamagic: ['Empowered Spell', 'Extended Spell'],
    elementalAffinity: 'Fire',
    subclass: DRACONIC,
    feats: ['Elemental Adept (Fire)', 'Speedy', 'Spell Sniper', 'War Caster'],
  },
  Devastation: {
    cantrips: ['Elementalism', 'Light', 'Ray of Frost', 'Sorcerous Burst'],
    extraPrepared: ['Arcane Vigor', 'Burning Hands', 'Cloud of Daggers', 'Flame Blade', 'Ice Knife', 'Living Flame'],
    metamagic: ['Empowered Spell', 'Transmuted Spell'],
    elementalAffinity: 'Cold or Fire',
    subclass: DRACONIC,
    feats: ['Elemental Adept (Cold and Fire)', 'Spell Sniper', 'War Caster'],
  },
  Preservation: {
    cantrips: ['Blade Ward', 'Elementalism', 'Light', 'Sorcerous Burst'],
    extraPrepared: ['Alter Self', 'Arcane Vigor', 'False Life', 'Hold Person', 'Ray of Sickness', 'Witch Bolt'],
    metamagic: ['Heightened Spell', 'Twinned Spell'],
    elementalAffinity: 'Lightning or Poison',
    subclass: DRACONIC,
    feats: ['Elemental Adept (Lightning and Poison)', 'Spell Sniper', 'War Caster'],
  },
};

/** Suggested (not always-prepared) spells per specialization, by spell level. */
export const WOW_EVOKER_SUGGESTED_SPELLS: Readonly<Record<string, readonly SuggestedSpellLevel[]>> = {
  Augmentation: [
    { level: 3, spells: ['Fireball', 'Haste', 'Slow'] },
    { level: 4, spells: ['Fire Shield', 'Stoneskin'] },
    { level: 5, spells: ['Hold Monster', 'Wall of Stone'] },
    { level: 6, spells: ['Sunbeam'] },
    { level: 7, spells: ['Reverse Gravity'] },
    { level: 8, spells: ['Earthquake'] },
    { level: 9, spells: ['Time Stop'] },
  ],
  Devastation: [
    { level: 3, spells: ['Counterspell', 'Fly', 'Sleet Storm'] },
    { level: 4, spells: ['Ice Storm', 'Wall of Fire'] },
    { level: 5, spells: ['Cone of Cold', 'Telekinesis'] },
    { level: 6, spells: ['Azure Sweep', "Otiluke's Freezing Sphere"] },
    { level: 7, spells: ['Fire Storm', 'Lay Waste'] },
    { level: 8, spells: ['Incendiary Cloud'] },
    { level: 9, spells: ['Meteor Swarm'] },
  ],
  Preservation: [
    { level: 3, spells: ['Dispel Magic', 'Haste', 'Lightning Bolt'] },
    { level: 4, spells: ['Polymorph', 'Vitriolic Sphere'] },
    { level: 5, spells: ['Cloudkill', 'Hold Monster', 'Rescue'] },
    { level: 6, spells: ['Globe of Invulnerability'] },
    { level: 7, spells: ['Prismatic Spray'] },
    { level: 8, spells: ['Dominate Monster'] },
    { level: 9, spells: ['Time Stop'] },
  ],
};

export const WOW_EVOKER: HeroClassOption = {
  key: 'Sorcerer (World of Warcraft)',
  // The WoW name differs from the base name, so the row reads "Evoker (Sorcerer)".
  label: variantLabel('Evoker', 'Sorcerer'),
  name: 'Evoker',
  baseClass: 'Sorcerer',
  subclass: DRACONIC_SORCERY,
  sharedSubclass: true,
  subclassLevel: 1,
  subclassTerm: 'subclass',
  source: 'World of Warcraft',
  blurb: "An evoker wields the magic of all five dragonflights — the red flight's flame, the blue's "
    + "arcane focus, the black's might, the green's life and the bronze's command of time — to ruin "
    + 'foes and bolster allies, darting in and out of the fray. Evokers can empower, extend and transmute '
    + 'their spells, and charge them up before letting them loose.',
  heroNote: "Evoker is a hero class, usually started at level 3 or higher (level 1 with your DM's permission). "
    + 'Every evoker in World of Warcraft lore is a dracthyr — check with your DM before playing another species.',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Augmentation', desc: "Channels the black dragonflight's might to amplify allies, and bends time with the bronze." },
    { name: 'Devastation',  desc: "Rains the red flight's fire and the blue flight's arcane power down on the battlefield." },
    { name: 'Preservation', desc: 'Draws on the Emerald Dream and bronze time magic to heal allies and undo harm.' },
  ],
  respecOnLevelUp: true,
  spellTable: WOW_EVOKER_SPELL_TABLE,
  spellTableTitle: 'Evoker Spells',
  guidance: WOW_EVOKER_GUIDANCE,
  suggestedSpells: WOW_EVOKER_SUGGESTED_SPELLS,
};

// ── Hunter (Ranger) ──────────────────────────────────────────────────────────

export const WOW_HUNTER_SPECIALIZATIONS = ['Beast Mastery', 'Marksmanship', 'Survival'] as const;

/**
 * The World of Warcraft hunter spells (✦), on the Ranger list. Their full text is
 * in the spell data; suggestions flag them from there.
 */
export const WOW_HUNTER_SPELLS = ['Freezing Trap', 'Serpent Sting', 'Explosive Trap'] as const;

const HUNTER_RANGED_MASTERY = ['Heavy Crossbows', 'Longbows', 'Muskets'] as const;

/**
 * Per-specialization picks (class step box + spells-step highlights + sheet panel
 * + level-up badges). Rangers get no cantrips; the level-2 Fighting Style and the
 * level-3 subclass are badged in the level-up modal. Muskets are text only.
 */
export const WOW_HUNTER_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  'Beast Mastery': {
    level1Spells: ['Ensnaring Strike', 'Speak with Animals'],
    weaponMastery: HUNTER_RANGED_MASTERY,
    weaponMasteryCount: 2,
    fightingStyles: ['Archery'],
    subclass: { name: BEAST_MASTER, note: 'pick your pet family on your sheet.' },
    levelTip: { level: 6, text: 'You gain Pet Specialization instead of Roving.' },
    feats: ['Crossbow Expert', 'Medium Armor Master', 'Piercer', 'Sharpshooter', 'Weapon Master'],
  },
  Marksmanship: {
    level1Spells: ['Cure Wounds', 'Ensnaring Strike'],
    weaponMastery: HUNTER_RANGED_MASTERY,
    weaponMasteryCount: 2,
    fightingStyles: ['Archery'],
    subclass: { name: 'Hunter' },
    feats: ['Crossbow Expert', 'Medium Armor Master', 'Piercer', 'Sharpshooter'],
  },
  Survival: {
    level1Spells: ['Cure Wounds', 'Ensnaring Strike'],
    weaponMastery: ['Glaives', 'Halberds', 'Pikes'],
    weaponMasteryCount: 2,
    fightingStyles: ['Great Weapon Fighting'],
    subclass: { name: BEAST_MASTER, note: 'pick your pet family on your sheet.' },
    feats: ['Great Weapon Master', 'Poisoner', 'Polearm Master', 'Sentinel'],
  },
};

/** Suggested (not always-prepared) spells per specialization, by spell level. */
export const WOW_HUNTER_SUGGESTED_SPELLS: Readonly<Record<string, readonly SuggestedSpellLevel[]>> = {
  'Beast Mastery': [
    { level: 1, spells: ['Freezing Trap'] },
    { level: 2, spells: ['Beast Sense', 'Summon Beast'] },
    { level: 3, spells: ['Conjure Animals', 'Serpent Sting'] },
    { level: 4, spells: ['Dominate Beast'] },
    { level: 5, spells: ['Conjure Volley'] },
  ],
  Marksmanship: [
    { level: 1, spells: ['Freezing Trap'] },
    { level: 2, spells: ['Cordon of Arrows', 'Magic Weapon'] },
    { level: 3, spells: ['Conjure Barrage', 'Lightning Arrow', 'Serpent Sting'] },
    { level: 4, spells: ['Conjure Woodland Beings', 'Grasping Vine'] },
    { level: 5, spells: ['Conjure Volley', 'Swift Quiver'] },
  ],
  Survival: [
    { level: 1, spells: ['Freezing Trap'] },
    { level: 2, spells: ['Cordon of Arrows', 'Spike Growth'] },
    { level: 3, spells: ['Serpent Sting'] },
    { level: 4, spells: ['Grasping Vine', 'Stoneskin'] },
    { level: 5, spells: ['Explosive Trap', 'Steel Wind Strike'] },
  ],
};

export const WOW_HUNTER: HeroClassOption = {
  key: 'Ranger (World of Warcraft)',
  // The WoW name differs from the base name, so the row reads "Hunter (Ranger)".
  label: variantLabel('Hunter', 'Ranger'),
  name: 'Hunter',
  baseClass: 'Ranger',
  source: 'World of Warcraft',
  blurb: 'A hunter hears the call of the wild, slipping through the wilderness and laying traps for prey. '
    + 'Many fight beside a loyal pet while loosing arrows, firing guns or swinging polearms, staying on the '
    + 'move and keeping the battlefield under control.',
  subclassNote: 'Chosen as normal at Ranger level 3',
  subclassTerm: 'subclass',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Beast Mastery', desc: 'Commands a vicious animal companion while attacking from range.' },
    { name: 'Marksmanship',  desc: 'A lone, precise sharpshooter who stalks prey from afar.' },
    { name: 'Survival',      desc: 'A close-quarters polearm fighter who turns beasts, venom and traps on foes.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_HUNTER_GUIDANCE,
  suggestedSpells: WOW_HUNTER_SUGGESTED_SPELLS,
  hunterPets: true,
};

// ── Mage (Wizard) ────────────────────────────────────────────────────────────

export const WOW_MAGE_SPECIALIZATIONS = ['Arcane', 'Fire', 'Frost'] as const;

/**
 * The Wizard's PHB subclass every mage specialization recommends. Its name
 * clashes with the WoW Evoker (Sorcerer) class, so guidance text shows
 * {@link EVOKER_SCHOOL_LABEL} instead; the stored subclass stays 'Evoker'.
 */
export const EVOKER_SCHOOL = 'Evoker';

/** How the Wizard's Evoker subclass reads in guidance, so it isn't mistaken for the Evoker (Sorcerer) class. */
export const EVOKER_SCHOOL_LABEL = 'Evoker (school of evocation)';

/** The World of Warcraft mage spells (✦), on the Wizard list. Their full text is in the spell data. */
export const WOW_MAGE_SPELLS = ['Frost Nova', 'Flurry', 'Combustion', 'Mass Polymorph'] as const;

/** Base (non-wizard) spells the WoW Mage adds to its Wizard spell list. */
export const WOW_MAGE_EXTRA_SPELLS = ['Create Food and Water', 'Flame Strike', "Heroes' Feast"] as const;

const EVOKER_SCHOOL_PICK = { name: EVOKER_SCHOOL, label: EVOKER_SCHOOL_LABEL } as const;

/**
 * Per-specialization picks (class step box + spells-step highlights + sheet panel).
 * Wizards keep their level-1 spells in a spellbook, so `level1Spells` is the
 * starting spellbook; they are badged in the spells step with the cantrips.
 */
export const WOW_MAGE_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Arcane: {
    cantrips: ['Light', 'Mage Hand', 'Thunderclap'],
    level1Spells: ['Detect Magic', 'Feather Fall', 'Mage Armor', 'Magic Missile', 'Shield', 'Thunderwave'],
    subclass: EVOKER_SCHOOL_PICK,
    feats: ['Clearcasting', 'Spell Sniper', 'War Caster'],
  },
  Fire: {
    cantrips: ['Light', 'Mage Hand', 'Fire Bolt'],
    level1Spells: ['Burning Hands', 'Detect Magic', 'Feather Fall', 'Mage Armor', 'Shield', 'Thunderwave'],
    subclass: EVOKER_SCHOOL_PICK,
    feats: ['Elemental Adept', 'Hot Streak', 'Spell Sniper', 'War Caster'],
  },
  Frost: {
    cantrips: ['Light', 'Mage Hand', 'Ray of Frost'],
    level1Spells: ['Detect Magic', 'Feather Fall', 'Frost Nova', 'Ice Knife', 'Mage Armor', 'Shield'],
    subclass: EVOKER_SCHOOL_PICK,
    feats: ['Fingers of Frost', 'Spell Sniper', 'War Caster'],
  },
};

/**
 * Suggested (not always-prepared) spells per specialization, by spell level
 * (✦ WoW spells are flagged from the spell data). Mass Polymorph is a level-9
 * spell, so it sits in the level-9 row.
 */
export const WOW_MAGE_SUGGESTED_SPELLS: Readonly<Record<string, readonly SuggestedSpellLevel[]>> = {
  Arcane: [
    { level: 1, spells: ['Chromatic Orb', 'Comprehend Languages', 'Disguise Self', 'Find Familiar', 'Frost Nova'] },
    { level: 2, spells: ['Enhance Ability', 'Invisibility', 'Mirror Image', 'Misty Step', 'Shatter'] },
    { level: 3, spells: [
      'Blink', 'Counterspell', 'Create Food and Water', 'Dispel Magic', 'Haste', 'Remove Curse', 'Slow', 'Tongues'] },
    { level: 4, spells: [
      'Conjure Minor Elementals', 'Fire Shield', 'Greater Invisibility', "Otiluke's Resilient Sphere", 'Polymorph'] },
    { level: 5, spells: ["Bigby's Hand", 'Teleportation Circle', 'Wall of Force'] },
    { level: 6, spells: ['Arcane Gate', 'Disintegrate', 'Globe of Invulnerability', "Heroes' Feast"] },
    { level: 7, spells: ['Forcecage', "Mordenkainen's Sword", 'Prismatic Spray', 'Teleport'] },
    { level: 8, spells: ['Befuddlement', 'Maze'] },
    { level: 9, spells: ['Mass Polymorph', 'Prismatic Wall', 'Time Stop'] },
  ],
  Fire: [
    { level: 1, spells: ['Chromatic Orb', 'Comprehend Languages', 'Disguise Self', 'Find Familiar', 'Frost Nova'] },
    { level: 2, spells: [
      "Dragon's Breath", 'Enhance Ability', 'Flaming Sphere', 'Invisibility', 'Mirror Image', 'Misty Step',
      'Scorching Ray'] },
    { level: 3, spells: [
      'Counterspell', 'Create Food and Water', 'Dispel Magic', 'Fireball', 'Haste', 'Remove Curse', 'Slow', 'Tongues'] },
    { level: 4, spells: ['Conjure Minor Elementals', 'Fire Shield', 'Greater Invisibility', 'Polymorph', 'Wall of Fire'] },
    { level: 5, spells: ['Flame Strike', 'Teleportation Circle'] },
    { level: 6, spells: ['Arcane Gate', 'Combustion', "Heroes' Feast"] },
    { level: 7, spells: ['Delayed Blast Fireball', 'Prismatic Spray', 'Teleport'] },
    { level: 8, spells: ['Befuddlement', 'Incendiary Cloud', 'Maze'] },
    { level: 9, spells: ['Mass Polymorph', 'Meteor Swarm', 'Prismatic Wall', 'Time Stop'] },
  ],
  Frost: [
    { level: 1, spells: ['Chromatic Orb', 'Comprehend Languages', 'Disguise Self', 'Find Familiar'] },
    { level: 2, spells: ["Dragon's Breath", 'Enhance Ability', 'Invisibility', 'Mirror Image', 'Misty Step'] },
    { level: 3, spells: [
      'Counterspell', 'Create Food and Water', 'Dispel Magic', 'Flurry', 'Haste', 'Remove Curse', 'Sleet Storm', 'Slow',
      'Tongues'] },
    { level: 4, spells: ['Conjure Minor Elementals', 'Fire Shield', 'Greater Invisibility', 'Ice Storm', 'Polymorph'] },
    { level: 5, spells: ['Cone of Cold', 'Teleportation Circle'] },
    { level: 6, spells: ['Arcane Gate', "Heroes' Feast", "Otiluke's Freezing Sphere", 'Wall of Ice'] },
    { level: 7, spells: ['Prismatic Spray', 'Teleport'] },
    { level: 8, spells: ['Befuddlement', 'Maze'] },
    { level: 9, spells: ['Mass Polymorph', 'Prismatic Wall', 'Time Stop'] },
  ],
};

export const WOW_MAGE: HeroClassOption = {
  key: 'Wizard (World of Warcraft)',
  // The WoW name differs from the base name, so the row reads "Mage (Wizard)".
  label: variantLabel('Mage', 'Wizard'),
  name: 'Mage',
  baseClass: 'Wizard',
  source: 'World of Warcraft',
  blurb: 'A mage walks a path of intellect and discipline. Mages wear no armor, trusting arcane shields to turn '
    + 'blows aside while they hurl fire and frost at their foes. Azeroth still eyes them with suspicion — the '
    + "Highborne's reckless magic once opened the way for the Burning Legion — and many mages answer to the "
    + 'Kirin Tor of Dalaran.',
  subclassNote: 'Chosen as normal at Wizard level 3',
  subclassTerm: 'subclass',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Arcane', desc: 'Bends raw arcane magic to its will to overwhelm foes.' },
    { name: 'Fire',   desc: 'Assails enemies with searing, combustive flame.' },
    { name: 'Frost',  desc: 'Freezes enemies in their tracks, then shatters them.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  level1SpellsLabel: 'Spellbook',
  guidance: WOW_MAGE_GUIDANCE,
  suggestedSpells: WOW_MAGE_SUGGESTED_SPELLS,
  extraSpellList: WOW_MAGE_EXTRA_SPELLS,
  renownNote: 'Adopting the Mage raises your Renown with the Kirin Tor by 3 — ask your DM to record it.',
};

// ── Paladin ──────────────────────────────────────────────────────────────────

export const WOW_PALADIN_SPECIALIZATIONS = ['Holy', 'Protection', 'Retribution'] as const;

/** The WoW-only paladin oath — the server offers it to WoW paladins only. */
export const OATH_OF_THE_HOLY = 'Oath of the Holy';

/** Oath of the Holy spells, always prepared, by Paladin level. Features text comes from the server. */
export const OATH_OF_THE_HOLY_SPELLS: readonly SubclassSpellRow[] = [
  { classLevel: 3,  spells: ['Cure Wounds', 'Healing Word'] },
  { classLevel: 5,  spells: ['Lesser Restoration', 'Prayer of Healing'] },
  { classLevel: 9,  spells: ['Dispel Magic', 'Mass Healing Word'] },
  { classLevel: 13, spells: ['Aura of Life', 'Death Ward'] },
  { classLevel: 17, spells: ['Greater Restoration', 'Mass Cure Wounds'] },
];

/** Per-specialization picks (class step box + sheet panel). Paladins have no level-1 spells step, so spells are text. */
export const WOW_PALADIN_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Holy: {
    level1Spells: ['Cure Wounds', 'Shield of Faith'],
    weaponMastery: ['Flails', 'Longswords', 'Morningstars', 'Warhammers'],
    fightingStyles: ['Blessed Warrior'],
    fightingStyleCantrips: ['Sacred Flame', 'Spare the Dying'],
    subclass: { name: OATH_OF_THE_HOLY },
    feats: ['Durable', 'Healer', 'Inspiring Leader', 'Shield Master', 'War Caster'],
    note: 'Want to heal above all else? A Cleric of the War Domain can follow this same Holy guidance.',
  },
  Protection: {
    level1Spells: ['Compelled Duel', 'Searing Smite'],
    weaponMastery: ['Battleaxes', 'Flails', 'Longswords', 'Morningstars', 'Warhammers'],
    fightingStyles: ['Interception', 'Protection'],
    subclass: { name: 'Oath of Devotion' },
    feats: ['Durable', 'Heavy Armor Master', 'Sentinel', 'Shield Master', 'Tough'],
  },
  Retribution: {
    level1Spells: ['Heroism', 'Wrathful Smite'],
    weaponMastery: ['Greataxes', 'Greatswords', 'Mauls'],
    fightingStyles: ['Great Weapon Fighting'],
    subclass: { name: 'Oath of Vengeance' },
    feats: ['Crusher', 'Great Weapon Master', 'Slasher'],
  },
};

/** Suggested (not always-prepared) spells per specialization, by spell level. */
export const WOW_PALADIN_SUGGESTED_SPELLS: Readonly<Record<string, readonly SuggestedSpellLevel[]>> = {
  Holy: [
    { level: 1, spells: ['Bless', 'Heroism', 'Searing Smite'] },
    { level: 2, spells: ['Aid', 'Warding Bond'] },
    { level: 3, spells: ["Crusader's Mantle", 'Revivify'] },
    { level: 4, spells: ['Aura of Purity', 'Divine Shield'] },
    { level: 5, spells: ['Circle of Power', 'Raise Dead'] },
  ],
  Protection: [
    { level: 1, spells: ['Heroism', 'Shield of Faith'] },
    { level: 2, spells: ['Shining Smite', 'Warding Bond'] },
    { level: 3, spells: ["Crusader's Mantle", 'Guided Prayer'] },
    { level: 4, spells: ['Banishment', 'Divine Shield'] },
    { level: 5, spells: ['Banishing Smite', 'Circle of Power'] },
  ],
  Retribution: [
    { level: 1, spells: ['Divine Favor', 'Thunderous Smite'] },
    { level: 2, spells: ['Consecration', 'Shining Smite'] },
    { level: 3, spells: ["Crusader's Mantle", 'Elemental Weapon'] },
    { level: 4, spells: ['Staggering Smite'] },
    { level: 5, spells: ['Destructive Wave'] },
  ],
};

export const WOW_PALADIN: HeroClassOption = {
  key: 'Paladin (World of Warcraft)',
  label: variantLabel('Paladin', 'Paladin'),
  name: 'Paladin',
  baseClass: 'Paladin',
  source: 'World of Warcraft',
  blurb: 'A holy knight who calls on the Light to mend the wounded, stand between allies '
    + 'and harm, and bring righteous fury down on the wicked.',
  subclassNote: 'Chosen as normal at Paladin level 3',
  subclassTerm: 'oath',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Holy',        desc: 'A healer who wraps allies in the Light and shields them from harm.' },
    { name: 'Protection',  desc: 'A sword-and-shield defender who heals themselves and others while holding the line.' },
    { name: 'Retribution', desc: 'A zealous crusader with a two-handed weapon who smites the wicked.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_PALADIN_GUIDANCE,
  suggestedSpells: WOW_PALADIN_SUGGESTED_SPELLS,
  subclassSpells: { [OATH_OF_THE_HOLY]: OATH_OF_THE_HOLY_SPELLS },
};

// ── Priest (Cleric) ──────────────────────────────────────────────────────────

export const WOW_PRIEST_SPECIALIZATIONS = ['Discipline', 'Holy', 'Shadow'] as const;

/** The WoW-only cleric domains (defined with their sheet cards); feature text comes from the server. */
export { DISCIPLINE_DOMAIN, SHADOW_DOMAIN };

/** Discipline Domain spells, always prepared, by Cleric level (✦ WoW spells are flagged from the spell data). */
export const DISCIPLINE_DOMAIN_SPELLS: readonly SubclassSpellRow[] = [
  { classLevel: 3, spells: ['Arcane Vigor', 'Guiding Bolt', 'Magic Weapon', 'Shield of Faith'] },
  { classLevel: 5, spells: ['Prayer of Mending', 'Protection from Energy'] },
  { classLevel: 7, spells: ['Guardian of Faith', 'Stoneskin'] },
  { classLevel: 9, spells: ['Circle of Power', 'Destructive Wave'] },
];

/** Shadow Domain spells, always prepared, by Cleric level. */
export const SHADOW_DOMAIN_SPELLS: readonly SubclassSpellRow[] = [
  { classLevel: 3, spells: ['Crown of Madness', 'Dissonant Whispers', 'Mind Spike', 'Shadow Word: Pain'] },
  { classLevel: 5, spells: ['Summon Undead', 'Vampiric Touch'] },
  { classLevel: 7, spells: ["Evard's Black Tentacles", 'Psychic Horror'] },
  { classLevel: 9, spells: ['Dominate Person', 'Void Eruption'] },
];

/** Base (non-cleric) spells the WoW Priest adds to its Cleric spell list. */
export const WOW_PRIEST_EXTRA_SPELLS = ['Blur', 'Levitate'] as const;

const THAUMATURGE = { feature: 'Divine Order', option: 'Thaumaturge' } as const;

/**
 * Per-specialization picks (class step box + spells-step highlights + sheet panel).
 * The wizard has no Divine Order picker, so Thaumaturge stays text.
 */
export const WOW_PRIEST_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Discipline: {
    featureChoice: THAUMATURGE,
    cantrips: ['Guidance', 'Resistance', 'Thaumaturgy', 'Word of Radiance'],
    level1Spells: ['Cure Wounds', 'Guiding Bolt', 'Sanctuary', 'Shield of Faith'],
    subclass: { name: DISCIPLINE_DOMAIN },
    feats: ['Durable', 'Inspiring Leader', 'Mage Slayer', 'War Caster'],
  },
  Holy: {
    featureChoice: THAUMATURGE,
    cantrips: ['Guidance', 'Light', 'Sacred Flame', 'Spare the Dying'],
    level1Spells: ['Bless', 'Cure Wounds', 'Healing Word', 'Purify Food and Drink'],
    subclass: { name: 'Life Domain' },
    feats: ['Chef', 'Healer', 'Inspiring Leader', 'War Caster'],
  },
  Shadow: {
    featureChoice: THAUMATURGE,
    cantrips: ['Mending', 'Resistance', 'Thaumaturgy', 'Toll the Dead'],
    level1Spells: ['Bane', 'Command', 'Healing Word', 'Shadow Word: Pain'],
    subclass: { name: SHADOW_DOMAIN },
    feats: ['Actor', 'Mage Slayer', 'Shadow Touched', 'Skulker', 'Telepathic'],
  },
};

/** Suggested (not always-prepared) spells per specialization, by spell level. */
export const WOW_PRIEST_SUGGESTED_SPELLS: Readonly<Record<string, readonly SuggestedSpellLevel[]>> = {
  Discipline: [
    { level: 1, spells: ['Bless', 'Protection from Evil and Good', 'Shadow Word: Pain'] },
    { level: 2, spells: ['Aid', 'Blur', 'Levitate', 'Spiritual Weapon'] },
    { level: 3, spells: ['Aura of Vitality', 'Dispel Magic', 'Spirit Guardians'] },
    { level: 4, spells: ['Aura of Purity', 'Holy Nova'] },
    { level: 5, spells: ['Flame Strike', 'Greater Restoration', 'Summon Celestial'] },
    { level: 6, spells: ['Blade Barrier', 'Sunbeam'] },
    { level: 7, spells: ['Fire Storm', 'Power Word Fortify'] },
    { level: 8, spells: ['Sunburst'] },
    { level: 9, spells: ['Gate'] },
  ],
  Holy: [
    { level: 1, spells: ['Detect Evil and Good', 'Protection from Evil and Good', 'Shadow Word: Pain'] },
    { level: 2, spells: ['Blur', 'Calm Emotions', 'Prayer of Healing', 'Protection from Poison'] },
    { level: 3, spells: ['Beacon of Hope', 'Daylight', 'Prayer of Mending'] },
    { level: 4, spells: ['Aura of Purity', 'Guardian of Faith', 'Holy Nova'] },
    { level: 5, spells: ['Commune', 'Dispel Evil and Good', 'Raise Dead'] },
    { level: 6, spells: ['Heal', 'Sunbeam'] },
    { level: 7, spells: ['Conjure Celestial', 'Regenerate'] },
    { level: 8, spells: ['Holy Aura'] },
    { level: 9, spells: ['Apotheosis', 'Mass Heal'] },
  ],
  Shadow: [
    { level: 1, spells: ['Detect Poison and Disease'] },
    { level: 2, spells: ['Blindness/Deafness', 'Blur', 'Hold Person', 'Silence'] },
    { level: 3, spells: ['Bestow Curse', 'Dispel Magic', 'Speak with Dead'] },
    { level: 4, spells: ['Banishment', 'Freedom of Movement', 'Locate Creature'] },
    { level: 5, spells: ['Contagion', 'Geas', 'Insect Plague'] },
    { level: 6, spells: ['Create Undead', 'Harm'] },
    { level: 7, spells: ['Etherealness', 'Plane Shift'] },
    { level: 8, spells: ['Antimagic Field'] },
    { level: 9, spells: ['Astral Projection'] },
  ],
};

export const WOW_PRIEST: HeroClassOption = {
  key: 'Cleric (World of Warcraft)',
  // The WoW name differs from the base name, so the row reads "Priest (Cleric)".
  label: variantLabel('Priest', 'Cleric'),
  name: 'Priest',
  baseClass: 'Cleric',
  source: 'World of Warcraft',
  blurb: 'A priest draws on two opposing forces. The Light — whether the Holy Light, Elune, or another '
    + 'power — heals and protects; Shadow breaks the will and drains the life of foes. Priests wield '
    + 'both to keep allies standing and lay enemies low.',
  subclassNote: 'Chosen as normal at Cleric level 3',
  subclassTerm: 'domain',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Discipline', desc: 'A pragmatist who balances Light and Shadow, shielding allies while smiting foes.' },
    { name: 'Holy',       desc: 'A devout healer who blesses allies and mends their wounds with the Light.' },
    { name: 'Shadow',     desc: 'Embraces the Void to wither flesh and twist the minds of enemies.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_PRIEST_GUIDANCE,
  suggestedSpells: WOW_PRIEST_SUGGESTED_SPELLS,
  subclassSpells: { [DISCIPLINE_DOMAIN]: DISCIPLINE_DOMAIN_SPELLS, [SHADOW_DOMAIN]: SHADOW_DOMAIN_SPELLS },
  extraSpellList: WOW_PRIEST_EXTRA_SPELLS,
  featureCards: priestFeatureCards,
};

// ── Rogue ────────────────────────────────────────────────────────────────────

export const WOW_ROGUE_SPECIALIZATIONS = ['Assassination', 'Outlaw', 'Subtlety'] as const;

/** The WoW-only rogue subclass — the server offers it to WoW rogues only. Features text comes from the server. */
export const SWASHBUCKLER = 'Swashbuckler';

/** Per-specialization picks (class step box + sheet panel). Rogues have no spells, so there are none to suggest. */
export const WOW_ROGUE_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Assassination: {
    weaponMastery: ['Daggers', 'Shortbows'],
    subclass: { name: 'Assassin' },
    levelTip: { level: 5, text: "Lean on Cunning Strike's Poison option — it's this specialization's signature move." },
    feats: ['Actor', 'Alert', 'Defensive Duelist', 'Piercer', 'Poisoner', 'Skulker', 'Speedy'],
  },
  Outlaw: {
    weaponMastery: ['Daggers', 'Rapiers'],
    subclass: { name: SWASHBUCKLER },
    feats: ['Athlete', 'Defensive Duelist', 'Martial Weapon Training', 'Piercer', 'Speedy', 'Tough'],
  },
  Subtlety: {
    weaponMastery: ['Daggers', 'Maces'],
    subclass: { name: 'Soulknife' },
    feats: ['Dual Wielder', 'Mage Slayer', 'Shadow Touched', 'Skulker'],
  },
};

export const WOW_ROGUE: HeroClassOption = {
  key: 'Rogue (World of Warcraft)',
  label: variantLabel('Rogue', 'Rogue'),
  name: 'Rogue',
  baseClass: 'Rogue',
  source: 'World of Warcraft',
  blurb: 'A blade in the dark who wins with poison, nerve, or shadow rather than brute force. '
    + 'Rogues in this world often answer to groups like SI:7, the Defias Brotherhood, or the Deathstalkers.',
  subclassNote: 'Chosen as normal at Rogue level 3',
  subclassTerm: 'subclass',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Assassination', desc: 'A poisoner who strikes with a pair of toxin-coated daggers.' },
    { name: 'Outlaw',        desc: 'A swaggering swashbuckler who duels toe-to-toe with agility and guile.' },
    { name: 'Subtlety',      desc: 'A shadow-wielder who strikes from darkness and vanishes again.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_ROGUE_GUIDANCE,
  wowSubclasses: [SWASHBUCKLER],
};

// ── Shaman (Barbarian) ───────────────────────────────────────────────────────

export const WOW_SHAMAN_SPECIALIZATIONS = ['Elemental', 'Enhancement', 'Restoration'] as const;

/** Every WoW barbarian's level-3 Totems replace Primal Knowledge (feature text comes from the server). */
const TOTEMS_NOTE = 'plus Totems instead of Primal Knowledge.';

/** Per-specialization picks (class step box + sheet panel). Barbarians have no spells, so there are none to suggest. */
export const WOW_SHAMAN_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Elemental: {
    weaponMastery: ['Battleaxes', 'Longswords', 'Maces'],
    weaponMasteryCount: 2,
    subclass: { name: PATH_OF_THE_ELEMENTS, note: TOTEMS_NOTE },
    feats: ['Athlete', 'Crusher', 'Durable', 'Medium Armor Master', 'Ritual Caster', 'Slasher'],
  },
  Enhancement: {
    weaponMastery: ['Handaxes', 'Light Hammers', 'Scimitars', 'Shortswords'],
    weaponMasteryCount: 2,
    subclass: { name: PATH_OF_THE_SPIRITUAL_GUARDIAN, note: TOTEMS_NOTE },
    feats: ['Athlete', 'Charger', 'Crusher', 'Dual Wielder', 'Durable', 'Medium Armor Master', 'Slasher'],
  },
  Restoration: {
    weaponMastery: ['Flails', 'Maces', 'Warhammers'],
    weaponMasteryCount: 2,
    subclass: { name: 'Path of the World Tree', note: TOTEMS_NOTE },
    feats: ['Chef', 'Crusher', 'Durable', 'Inspiring Leader', 'Medium Armor Master', 'Sentinel', 'Shield Master'],
  },
};

export const WOW_SHAMAN: HeroClassOption = {
  key: 'Barbarian (World of Warcraft)',
  // The WoW name differs from the base name, so the row reads "Shaman (Barbarian)".
  label: variantLabel('Shaman', 'Barbarian'),
  name: 'Shaman',
  baseClass: 'Barbarian',
  source: 'World of Warcraft',
  blurb: 'A shaman communes with the elemental spirits of air, earth, fire and water, keeping them '
    + 'in balance, and channels them through totems and auras rather than traditional spellcasting.',
  subclassNote: 'Chosen as normal at Barbarian level 3',
  subclassTerm: 'path',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Elemental',   desc: 'Channels storms of lightning, fire, and frost into destructive surges.' },
    { name: 'Enhancement', desc: 'Charges weapon strikes with elemental power in the thick of melee.' },
    { name: 'Restoration', desc: "Draws on water's restorative power to heal and protect allies." },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_SHAMAN_GUIDANCE,
  wowSubclasses: [PATH_OF_THE_ELEMENTS, PATH_OF_THE_SPIRITUAL_GUARDIAN],
  renownNote: 'Adopting the Shaman raises your Renown with the Earthen Ring by 3 — ask your DM to record it.',
  featureCards: shamanFeatureCards,
};

// ── Warlock ──────────────────────────────────────────────────────────────────

export const WOW_WARLOCK_SPECIALIZATIONS = ['Affliction', 'Demonology', 'Destruction'] as const;

export const FIEND_PATRON = 'Fiend Patron';
export const GREAT_OLD_ONE_PATRON = 'Great Old One Patron';

/**
 * The World of Warcraft Eldritch Invocations the guidance names. Their full text
 * is not published yet, and invocations aren't modelled in this app — they are
 * recommendation text only, marked ✦.
 */
export const WOW_WARLOCK_INVOCATIONS = [
  'Pact of the Legion', 'Curse of Corruption', 'Health Funnel', 'Call of the Void',
  'Legion Summoning', 'Expendable Minions', 'Master Demonologist',
] as const;

const FIEND_NOTE = "draws on the Burning Legion's fel power.";
const GREAT_OLD_ONE_NOTE = 'draws on the Void and the Old Gods.';

/**
 * Per-specialization picks (class step box + spells-step highlights + sheet panel).
 * The warlock picks its patron at level 1 in the wizard, where the recommended one
 * is badged (never auto-selected).
 */
export const WOW_WARLOCK_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Affliction: {
    cantrips: ['Eldritch Blast', 'Poison Spray'],
    level1Spells: ['Hex', 'Witch Bolt'],
    invocations: {
      level1: ['Pact of the Legion'],
      level2: ['Agonizing Blast', 'Curse of Corruption'],
      fromLevel5: ['Call of the Void', 'Eldritch Mind', 'Gift of the Depths', 'Legion Summoning', 'Visions of Distant Realms'],
    },
    subclass: { name: GREAT_OLD_ONE_PATRON, note: GREAT_OLD_ONE_NOTE },
    feats: [],
  },
  Demonology: {
    cantrips: ['Eldritch Blast', 'Toll the Dead'],
    level1Spells: ['Arms of Hadar', 'Hex'],
    invocations: {
      level1: ['Pact of the Legion'],
      level2: ['Health Funnel', 'Repelling Blast'],
      fromLevel5: [
        'Call of the Void', 'Expendable Minions', 'Gift of the Depths', 'Legion Summoning',
        'Master Demonologist', 'Visions of Distant Realms',
      ],
    },
    subclass: { name: FIEND_PATRON, note: FIEND_NOTE },
    feats: [],
  },
  Destruction: {
    cantrips: ['Eldritch Blast', 'Thunderclap'],
    level1Spells: ['Hellish Rebuke', 'Hex'],
    invocations: {
      level1: ['Pact of the Legion'],
      level2: ['Agonizing Blast', 'Repelling Blast'],
      fromLevel5: ['Call of the Void', 'Gift of the Depths', 'Legion Summoning', 'Visions of Distant Realms'],
    },
    subclass: { name: FIEND_PATRON, note: FIEND_NOTE },
    feats: [],
  },
};

/** Suggested spells per specialization, by spell level (✦ WoW spells are flagged from the spell data). */
export const WOW_WARLOCK_SUGGESTED_SPELLS: Readonly<Record<string, readonly SuggestedSpellLevel[]>> = {
  Affliction: [
    { level: 1, spells: ['Bane'] },
    { level: 2, spells: ['Ray of Enfeeblement'] },
    { level: 3, spells: ['Fear'] },
    { level: 4, spells: ['Blight'] },
    { level: 5, spells: ['Synaptic Static'] },
    { level: 6, spells: ['Eyebite'] },
    { level: 7, spells: ['Finger of Death'] },
    { level: 8, spells: ['Befuddlement'] },
    { level: 9, spells: ['Weird'] },
  ],
  Demonology: [
    { level: 1, spells: ['Hellish Rebuke'] },
    { level: 2, spells: ['Suggestion'] },
    { level: 3, spells: ["Hand of Gul'dan"] },
    { level: 4, spells: ['Summon Aberration'] },
    { level: 5, spells: ['Planar Binding'] },
    { level: 6, spells: ['Summon Fiend'] },
    { level: 7, spells: ['Plane Shift'] },
    { level: 8, spells: ['Dominate Monster'] },
    { level: 9, spells: ['Gate'] },
  ],
  Destruction: [
    { level: 1, spells: ['Arms of Hadar'] },
    { level: 2, spells: ['Cloud of Daggers'] },
    { level: 3, spells: ['Rain of Fire'] },
    { level: 4, spells: ['Blight'] },
    { level: 5, spells: ["Jallarzi's Storm of Radiance"] },
    { level: 6, spells: ['Circle of Death'] },
    { level: 7, spells: ['Finger of Death'] },
    { level: 8, spells: ['Power Word Stun'] },
    { level: 9, spells: ['Power Word Kill'] },
  ],
};

export const WOW_WARLOCK: HeroClassOption = {
  key: 'Warlock (World of Warcraft)',
  label: variantLabel('Warlock', 'Warlock'),
  name: 'Warlock',
  baseClass: 'Warlock',
  source: 'World of Warcraft',
  blurb: "A warlock strikes a bargain with the Burning Legion's demons or the entities of the Void, "
    + 'then turns that stolen power against the Legion itself — calling up demon minions such as imps, '
    + 'voidwalkers, sayaad and felhunters, and scouring foes with fel fire, corruption and curses. '
    + "The Fiend Patron draws on the Legion's fel powers; the Great Old One Patron on the Void and the Old Gods.",
  subclassNote: 'Chosen as normal at Warlock level 1 (below)',
  subclassTerm: 'patron',
  subclassLevel: 1,
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Affliction',  desc: 'Wields the shadow magic of the Void to inflict lingering torment.' },
    { name: 'Demonology',  desc: 'Harvests soul energy to summon demons and bend them to their will.' },
    { name: 'Destruction', desc: 'Burns foes away with chaotic shadow, fire and fel magic.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_WARLOCK_GUIDANCE,
  suggestedSpells: WOW_WARLOCK_SUGGESTED_SPELLS,
  suggestedSpellsNote: 'When you cast Summon Fiend, the fiend takes the look of a Burning Legion demon: '
    + 'an infernal for the Devil option, a demonic tyrant for Yugoloth, or a vilefiend for Demon.',
  wowInvocations: WOW_WARLOCK_INVOCATIONS,
};

// ── Warrior (Fighter) ────────────────────────────────────────────────────────

export const WOW_WARRIOR_SPECIALIZATIONS = ['Arms', 'Fury', 'Protection'] as const;

export const CHAMPION = 'Champion';

/**
 * The World of Warcraft Battle Master maneuvers. Maneuvers aren't modelled in
 * this app — they are recommendation text (marked ✦) and the sheet's Battle
 * Master card describes them.
 */
export const WOW_WARRIOR_MANEUVERS = [
  'Battle Shout', 'Demoralizing Shout', 'Heroic Leap', 'Mortal Strike', 'Warding Maneuver',
] as const;

/**
 * Per-specialization picks (class step box + sheet panel). Fighters have no spells,
 * so there are none to suggest. The Fighting Style is a level-1 choice the wizard
 * has no picker for, so it stays text.
 */
export const WOW_WARRIOR_GUIDANCE: Readonly<Record<string, SpecializationGuidance>> = {
  Arms: {
    fightingStyles: ['Great Weapon Fighting'],
    weaponMastery: ['Greataxes', 'Greatswords', 'Mauls'],
    subclass: { name: BATTLE_MASTER },
    maneuvers: [
      'Battle Shout', 'Disarming Attack', 'Distracting Strike', 'Mortal Strike', 'Pushing Attack',
      'Sweeping Attack', 'Trip Attack',
    ],
    feats: ['Charger', 'Crusher', 'Great Weapon Master', 'Piercer', 'Speedy', 'Slasher'],
  },
  Fury: {
    fightingStyles: ['Two-Weapon Fighting'],
    weaponMastery: ['Scimitars'],
    subclass: { name: CHAMPION },
    feats: ['Charger', 'Crusher', 'Dual Wielder', 'Piercer', 'Slasher'],
    note: 'A warrior can also be played as a Barbarian on the Path of the Berserker, following this same Fury guidance.',
  },
  Protection: {
    fightingStyles: ['Interception', 'Protection'],
    weaponMastery: ['Battleaxes', 'Longswords', 'Morningstars'],
    subclass: { name: BATTLE_MASTER },
    maneuvers: [
      'Bait and Switch', 'Battle Shout', 'Demoralizing Shout', 'Goading Attack', 'Maneuvering Attack', 'Parry',
      'Warding Maneuver',
    ],
    feats: ['Crusher', 'Durable', 'Heavy Armor Master', 'Piercer', 'Sentinel', 'Shield Master', 'Slasher'],
  },
};

export const WOW_WARRIOR: HeroClassOption = {
  key: 'Fighter (World of Warcraft)',
  // The WoW name differs from the base name, so the row reads "Warrior (Fighter)".
  label: variantLabel('Warrior', 'Fighter'),
  name: 'Warrior',
  baseClass: 'Fighter',
  source: 'World of Warcraft',
  blurb: 'A master of arms and armor who leads through sheer strength. Some warriors anchor the front '
    + 'line behind a shield; others cast the shield aside and pour their rage into deadly weapons.',
  subclassNote: 'Chosen as normal at Fighter level 3',
  subclassTerm: 'subclass',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Arms',       desc: 'A two-handed weapon master whose every blow is precise and devastating.' },
    { name: 'Fury',       desc: 'A dual-wielding berserker who whirls into the thick of the fray.' },
    { name: 'Protection', desc: 'A shield-bearing wall who guards allies and turns attacks back on foes.' },
  ],
  respecOnLevelUp: true,
  spellTable: [],
  guidance: WOW_WARRIOR_GUIDANCE,
  fightingStyleLevel: 1,
  wowManeuvers: WOW_WARRIOR_MANEUVERS,
  featureCards: warriorFeatureCards,
};

/**
 * Every WoW class variant, in class-list order. The Evoker is listed here too,
 * though it locks its (base-game) subclass like a hero class.
 */
export const WOW_CLASS_VARIANTS: readonly HeroClassOption[] = [
  WOW_DRUID, WOW_EVOKER, WOW_HUNTER, WOW_MAGE, WOW_PALADIN, WOW_PRIEST, WOW_ROGUE, WOW_SHAMAN, WOW_WARLOCK,
  WOW_WARRIOR,
];
