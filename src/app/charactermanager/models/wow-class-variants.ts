import type {
  HeroClassOption, SpecializationGuidance, SubclassSpellRow, SuggestedSpellLevel,
} from './hero-class';
import { PATH_OF_THE_ELEMENTS, PATH_OF_THE_SPIRITUAL_GUARDIAN, shamanFeatureCards } from './wow-shaman';

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

/** Every WoW class variant, in class-list order. */
export const WOW_CLASS_VARIANTS: readonly HeroClassOption[] = [WOW_DRUID, WOW_PALADIN, WOW_ROGUE, WOW_SHAMAN];
