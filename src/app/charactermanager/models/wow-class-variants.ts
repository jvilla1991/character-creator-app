import type {
  HeroClassOption, SpecializationGuidance, SubclassSpellRow, SuggestedSpellLevel,
} from './hero-class';

/**
 * World of Warcraft class *variants*: an ordinary 2024 base class plus a WoW
 * specialization, with no fixed subclass — the subclass is chosen normally when
 * it comes due. Stored as the base class (`clazz`), `specialization: <spec>`
 * and `subclass` null until then, so a character without a specialization
 * stays a plain base-game character everywhere.
 *
 * Each variant is one {@link HeroClassOption} entry: its specializations, the
 * per-specialization guidance (recommended picks), suggested spells, and any
 * WoW-only subclass's always-prepared spells. Components read these fields and
 * never special-case a variant. Everything here is guidance — never something
 * the app grants or forces. Text is paraphrased.
 */

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
  // The WoW name equals the base name, so the row reads just "Druid"; the
  // World of Warcraft source tag tells it apart from the base Druid row.
  label: 'Druid',
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
  // Same rule as the Druid: the WoW name equals the base name, so no parenthetical.
  label: 'Paladin',
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

/** Every WoW class variant, in class-list order. */
export const WOW_CLASS_VARIANTS: readonly HeroClassOption[] = [WOW_DRUID, WOW_PALADIN];
