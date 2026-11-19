// ---------------------------------------------------------------------------
// Demo-mode fixtures and shims for PCService.
//
// Everything here is DEMO-ONLY — it exists so the UI can be exercised without a
// backend. None of it is the rules authority: the real D&D engine lives in the
// manager-service (LevelUpService / ClassProgression / catalogs). These pure
// functions and tables mirror just enough to render a believable demo. Keep them
// in sync with the server tables if you rely on the demo for slot/feat checks.
//
// Relocated out of pc.service.ts so the service reads as CRUD/HTTP logic only;
// the seed data and demo math are never co-edited with the service methods.
// ---------------------------------------------------------------------------

import { PC } from '../models/pc';
import { PcActivityLogEntry } from '../models/pc-activity-log';
import { hitDieFor, modFromScore } from '../utils/character-math';
import { classSlotTable } from '../utils/spell-slots';
import { DEMON_HUNTER_SUBCLASS, EBON_BLADE_SUBCLASS, wowOnlySubclasses } from '../models/hero-class';
import {
  CIRCLE_OF_THE_MOON, DRACONIC_SORCERY, EVOKER_SCHOOL, FIEND_PATRON, OATH_OF_THE_HOLY, SWASHBUCKLER,
  WOW_CLASS_VARIANTS,
} from '../models/wow-class-variants';
import { WOW_MAGE_FEATS, WOW_MONK_FEATS } from '../models/wow-feats';
import { WARRIOR_OF_MYSTIC_BREWS } from '../models/wow-monk';
import { PATH_OF_THE_ELEMENTS } from '../models/wow-shaman';
import { SHADOW_DOMAIN } from '../models/wow-priest';
import { BATTLE_MASTER } from '../models/wow-warrior';
import { BEAST_MASTER } from '../models/wow-hunter';
import { BLESSED_WARRIOR, DRUIDIC_WARRIOR, VOID_WARRIOR } from '../models/cantrip-fighting-styles';

// ---------------------------------------------------------------------------
// Demo seed data — 3 fully-detailed PCs bound across both demo campaigns, plus an
// unbound World of Warcraft Death Knight, Demon Hunter, Druid, Evoker, Hunter, Mage, Monk, Paladin, Priest, Rogue,
// Shaman, Warlock and Warrior.
// Source: design_handoff_arcane_redesign/prototype/data.js
// ---------------------------------------------------------------------------
export const DEMO_PCS: PC[] = [
  {
    id: 1,
    name: 'Lyra Moonwhisper',
    playerName: 'Alice',
    player: 'Alice',
    campaignId: 'veiled',
    race: 'Half-Elf',
    clazz: 'Bard',
    subclass: 'College of Whispers',
    level: 7,
    background: 'Spy',
    alignment: 'Chaotic Good',
    portraitInitials: 'LM',
    portraitTint: 'celestial',
    hp: { cur: 42, max: 52, temp: 4 },
    ac: 15, init: 4, speed: 30, prof: 3,
    stats: { STR: 8, DEX: 18, CON: 14, INT: 13, WIS: 12, CHA: 18 },
    saves: ['DEX', 'CHA'],
    skills: { Deception: 'expert', Persuasion: 'expert', Insight: 'prof', Stealth: 'prof', Investigation: 'prof', Performance: 'prof' },
    conditions: [],
    coins: { cp: 12, sp: 48, gp: 264 },
    spellSlots: { 1: { max: 4, used: 2 }, 2: { max: 3, used: 1 }, 3: { max: 3, used: 0 }, 4: { max: 1, used: 0 } },
    spells: [
      { lvl: 0, name: 'Vicious Mockery', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 0, name: 'Minor Illusion', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 0, name: 'Mage Hand', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 1, name: 'Charm Person', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Disguise Self', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 1, name: 'Healing Word', school: 'Evocation', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Suggestion', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 2, name: 'Detect Thoughts', school: 'Divination', time: '1 action', prepared: true },
      { lvl: 3, name: 'Hypnotic Pattern', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 3, name: 'Counterspell', school: 'Abjuration', time: '1 reaction', prepared: true },
      { lvl: 4, name: 'Greater Invisibility', school: 'Illusion', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: "Rapier of the Last Lullaby", magic: true, dmg: '1d8+4 piercing', notes: '+1, sleep on crit' },
      { name: 'Hand Crossbow', dmg: '1d6+4 piercing', notes: '80/320 ft' },
      { name: 'Dagger', dmg: '1d4+4 piercing', notes: '20/60 ft (thrown)' },
    ],
    gear: [
      { name: 'Studded Leather Armor', equipped: true },
      { name: 'Cloak of Many Faces', magic: true, equipped: true, notes: 'attunement' },
      { name: 'Lute (silvered)', equipped: true },
      { name: "Thieves' Tools" },
      { name: 'Disguise Kit' },
      { name: 'Forgery Kit' },
      { name: 'Potion of Healing ×3' },
    ],
    features: [
      { name: 'Bardic Inspiration (d8)', source: 'Bard 5', desc: 'Bonus action; 4 uses per long rest.' },
      { name: 'Psychic Blades', source: 'Whispers 3', desc: 'Once per turn, +3d6 psychic damage when you hit with a weapon.' },
      { name: 'Words of Terror', source: 'Whispers 3', desc: 'After 1 minute of conversation, target Wis save or be frightened for 1 hour.' },
      { name: 'Jack of All Trades', source: 'Bard 2', desc: '+1 to ability checks not already proficient.' },
    ],
    traits: {
      Personality: 'Speaks in riddles when nervous; collects buttons from every city she visits.',
      Ideals: 'Truth is the rarest poison.',
      Bonds: 'Owes the Veiled Compass a debt sealed in blood ink.',
      Flaws: 'Cannot resist eavesdropping, even when it endangers the mission.',
    },
    bio: 'Born in the river-port of Vellow, Lyra learned cipher-songs from her grandmother before she could read. She joined the Compass at sixteen — first as a courier, now as something colder. The party knows her as a bard. Three of them suspect more.',
    notes: 'Owes the Crimson Lantern 60gp. Has a contact in Neverwinter named Olivar.',
  },
  {
    id: 2,
    name: 'Throk Ironjaw',
    playerName: 'Ben',
    player: 'Ben',
    campaignId: 'veiled',
    race: 'Half-Orc',
    clazz: 'Barbarian',
    subclass: 'Path of the Totem (Bear)',
    level: 7,
    background: 'Outlander',
    alignment: 'Neutral Good',
    portraitInitials: 'TI',
    portraitTint: 'crimson',
    hp: { cur: 78, max: 84, temp: 0 },
    ac: 16, init: 2, speed: 40, prof: 3,
    stats: { STR: 18, DEX: 14, CON: 17, INT: 8, WIS: 12, CHA: 10 },
    saves: ['STR', 'CON'],
    skills: { Athletics: 'expert', Survival: 'prof', Perception: 'prof', Intimidation: 'prof', Nature: 'prof' },
    conditions: ['raging'],
    coins: { cp: 4, sp: 12, gp: 89 },
    spellSlots: {},
    spells: [],
    weapons: [
      { name: "Greataxe 'Splitter'", magic: true, dmg: '1d12+5 slashing', notes: '+1, brutal critical' },
      { name: 'Handaxes (4)', dmg: '1d6+4 slashing', notes: '20/60 ft (thrown)' },
    ],
    gear: [
      { name: 'Hide Armor', equipped: true },
      { name: 'Bear Totem Cloak', magic: true, equipped: true, notes: 'resistance to all damage during rage' },
      { name: "Hunter's Trap (3)" },
      { name: 'Bedroll' },
      { name: 'Trophy Necklace', notes: 'tooth of the Shadow-Bear' },
    ],
    features: [
      { name: 'Rage', source: 'Barbarian 1', desc: 'Bonus action; 4 uses per long rest. +3 dmg, advantage on STR.' },
      { name: 'Bear Aspect', source: 'Totem 3', desc: 'Resistance to all damage except psychic while raging.' },
      { name: 'Reckless Attack', source: 'Barbarian 2', desc: 'Trade defense for advantage on STR attacks.' },
      { name: 'Feral Instinct', source: 'Barbarian 7', desc: "Advantage on initiative. Surprise doesn't stop you from raging." },
    ],
    traits: {
      Personality: 'Speaks rarely. When he does, listen.',
      Ideals: 'The pack survives, or no one does.',
      Bonds: 'Sworn to avenge his clan, slain by the Shadow-Bear cult.',
      Flaws: 'Cannot abide cages of any kind — including cities, contracts, or kindness.',
    },
    bio: 'The last of the Ironjaw clan. Walks south because that is where the cult fled. Travels with the Compass because Lyra found him bleeding outside Phandalin and didn\'t ask questions.',
    notes: '',
  },
  {
    id: 5,
    name: 'Pip Underfoot',
    playerName: 'Eve',
    player: 'Eve',
    campaignId: 'tomb',
    race: 'Halfling (Lightfoot)',
    clazz: 'Rogue',
    subclass: 'Arcane Trickster',
    level: 5,
    background: 'Criminal',
    alignment: 'Chaotic Good',
    portraitInitials: 'PU',
    portraitTint: 'emerald',
    hp: { cur: 34, max: 38, temp: 0 },
    ac: 16, init: 5, speed: 25, prof: 3,
    stats: { STR: 8, DEX: 20, CON: 14, INT: 14, WIS: 12, CHA: 13 },
    saves: ['DEX', 'INT'],
    skills: { Stealth: 'expert', Sleight: 'expert', Acrobatics: 'prof', Perception: 'prof', Investigation: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 0, gp: 472 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } },
    spells: [
      { lvl: 0, name: 'Mage Hand', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 0, name: 'Minor Illusion', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 0, name: 'Prestidigitation', school: 'Transmutation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Charm Person', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Disguise Self', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 1, name: 'Find Familiar', school: 'Conjuration', time: '1 hour', prepared: true,
        components: ['v', 's', 'm'],
        material: 'charcoal, incense, and herbs worth 10+ GP, consumed by the spell' },
      { lvl: 2, name: 'Invisibility', school: 'Illusion', time: '1 action', prepared: true },
    ],
    inventory: [
      { catalogKey: 'mc-find-familiar', name: 'Charcoal, Incense & Herbs (Find Familiar)',
        category: 'material-component', qty: 2, unitCostCp: 1000, consumedOnCast: true,
        spell: 'Find Familiar' },
    ],
    weapons: [
      { name: "Shortsword 'Whisper'", magic: true, dmg: '1d6+5 piercing', notes: '+1, silent' },
      { name: 'Shortbow', dmg: '1d6+5 piercing', notes: '80/320 ft' },
    ],
    gear: [
      { name: 'Studded Leather', equipped: true },
      { name: 'Cloak of Elvenkind', magic: true, equipped: true },
      { name: "Thieves' Tools" },
      { name: 'Caltrops (10)' },
      { name: 'Lockpicks (silvered)' },
    ],
    features: [
      { name: 'Sneak Attack', source: 'Rogue 1', desc: '+3d6 once per turn with advantage or ally adjacent.' },
      { name: 'Cunning Action', source: 'Rogue 2', desc: 'Bonus action: Dash, Disengage, or Hide.' },
      { name: 'Mage Hand Legerdemain', source: 'Trickster 3', desc: 'Invisible hand can pick pockets and locks.' },
      { name: 'Uncanny Dodge', source: 'Rogue 5', desc: 'Halve damage from an attack you can see.' },
    ],
    traits: {
      Personality: 'Always smiling. Especially when lying.',
      Ideals: 'Property is theft. So I\'m just balancing the books.',
      Bonds: 'The orphans on Brick Lane. They eat first.',
      Flaws: 'Cannot leave a locked door alone.',
    },
    bio: 'Lifted his first purse at six. Lifted his first relic at sixteen. The Sleeping Crown wants its third lifting, and Pip is the only halfling small enough to fit the keyhole.',
    notes: 'Familiar: Ash (raven). Bounty in three cities.',
  },
  // World of Warcraft module: a Death Knight (Paladin, Oath of the Ebon Blade),
  // unbound so it doesn't disturb the two seeded campaigns' stories.
  {
    id: 6,
    name: 'Isolde Grimhallow',
    playerName: 'Frank',
    player: 'Frank',
    campaignId: null,
    race: 'Human',
    clazz: 'Paladin',
    subclass: EBON_BLADE_SUBCLASS,
    specialization: 'Frost',
    level: 5,
    background: 'Soldier',
    alignment: 'Lawful Neutral',
    portraitInitials: 'IG',
    portraitTint: 'celestial',
    hp: { cur: 44, max: 44, temp: 0 },
    ac: 18, init: 0, speed: 30, prof: 3,
    stats: { STR: 17, DEX: 10, CON: 15, INT: 8, WIS: 12, CHA: 14 },
    // Where the scores come from, for the ability breakdown: a base of STR 14 and
    // CON 13, the Soldier background's +2 / +1, and the level 4 increase (+1 each).
    statAdjustments: {
      STR: [{ value: 2, label: 'Soldier' }, { value: 1, label: 'Level 4 Increase' }],
      CON: [{ value: 1, label: 'Soldier' }, { value: 1, label: 'Level 4 Increase' }],
    },
    saves: ['WIS', 'CHA'],
    skills: { Athletics: 'prof', Intimidation: 'prof', Religion: 'prof', Survival: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 14, gp: 87 },
    spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } },
    spells: [
      { lvl: 1, name: 'Bless', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Shield of Faith', school: 'Abjuration', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Find Steed', school: 'Conjuration', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: 'Longsword', dmg: '1d8+3 slashing', notes: 'Versatile (1d10)' },
      { name: 'Shortsword', dmg: '1d6+3 piercing', notes: 'Off hand' },
    ],
    gear: [
      { name: 'Chain Mail', equipped: true },
      { name: 'Holy Symbol (rune-carved)' },
    ],
    features: [
      { name: 'Weapon Mastery', source: 'Paladin 1', desc: 'Use the mastery properties of two kinds of weapons.' },
      { name: 'Fighting Style', source: 'Paladin 2', desc: 'Two-Weapon Fighting.' },
      { name: 'Extra Attack', source: 'Paladin 5', desc: 'Attack twice when you take the Attack action.' },
    ],
    traits: {
      Personality: 'Speaks rarely, and never above a whisper.',
      Ideals: 'Atonement. Every life saved repays one taken.',
      Bonds: 'The knights who broke free of the Lich King alongside her.',
      Flaws: 'The cold in her veins makes her slow to trust the living.',
    },
    bio: 'Raised in death to serve a tyrant, freed by the Ebon Blade, and still learning what to do with a second life.',
    notes: '',
  },
  // World of Warcraft hero class: Demon Hunter (Ranger) — stored as a Ranger with the
  // Demon Hunter subclass, Havoc specialization.
  {
    id: 7,
    name: 'Shalassa Felbrand',
    playerName: 'Gina',
    player: 'Gina',
    campaignId: null,
    race: 'Elf',
    clazz: 'Ranger',
    subclass: DEMON_HUNTER_SUBCLASS,
    specialization: 'Havoc',
    level: 7,
    background: 'Guard',
    alignment: 'Chaotic Good',
    portraitInitials: 'SF',
    portraitTint: 'emerald',
    hp: { cur: 60, max: 60, temp: 0 },
    ac: 16, init: 4, speed: 35, prof: 3,
    stats: { STR: 10, DEX: 18, CON: 14, INT: 10, WIS: 14, CHA: 8 },
    saves: ['STR', 'DEX'],
    skills: { Acrobatics: 'prof', Athletics: 'prof', Perception: 'expert', Stealth: 'prof', Survival: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 22, gp: 64 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 } },
    spells: [
      { lvl: 1, name: "Hunter's Mark", school: 'Divination', time: '1 bonus action', prepared: true },
      { lvl: 1, name: 'Ensnaring Strike', school: 'Conjuration', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Pass without Trace', school: 'Abjuration', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: 'Scimitar', dmg: '1d6+4 slashing', notes: 'Light, Finesse (warglaive)' },
      { name: 'Scimitar', dmg: '1d6 slashing', notes: 'Off hand (warglaive)' },
    ],
    gear: [
      { name: 'Studded Leather Armor', equipped: true },
      { name: 'Blindfold (fel-scorched)' },
      { name: 'Arcane Focus (fel crystal)' },
    ],
    features: [
      { name: 'Weapon Mastery', source: 'Ranger 1', desc: 'Use the mastery properties of two kinds of weapons.' },
      { name: 'Fighting Style', source: 'Ranger 2', desc: 'Two-Weapon Fighting.' },
      { name: 'Extra Attack', source: 'Ranger 5', desc: 'Attack twice when you take the Attack action.' },
    ],
    traits: {
      Personality: 'Restless; she hears the demon inside her more clearly in silence.',
      Ideals: 'Sacrifice. Whatever it costs, the Legion must fall.',
      Bonds: 'The Illidari who stood with her at the Black Temple.',
      Flaws: 'Most people see a monster, and some days she agrees.',
    },
    bio: "A night elf who gave up her eyes and took a demon's power to hunt the Burning Legion; the kin who once shunned her now need her.",
    notes: '',
  },
  // World of Warcraft Druid — an ordinary Druid with the Guardian specialization and
  // Circle of the Moon (chosen normally at level 3), so the Cat/Bear Form cards render.
  {
    id: 8,
    name: 'Hrogar Earthhoof',
    playerName: 'Hank',
    player: 'Hank',
    campaignId: null,
    race: 'Goliath',
    clazz: 'Druid',
    subclass: CIRCLE_OF_THE_MOON,
    specialization: 'Guardian',
    level: 6,
    background: 'Guide',
    alignment: 'Neutral Good',
    portraitInitials: 'HE',
    portraitTint: 'emerald',
    hp: { cur: 51, max: 51, temp: 0 },
    ac: 14, init: 0, speed: 35, prof: 3,
    stats: { STR: 14, DEX: 10, CON: 16, INT: 8, WIS: 17, CHA: 10 },
    saves: ['INT', 'WIS'],
    skills: { Animal: 'prof', Nature: 'prof', Survival: 'prof', Stealth: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 18, gp: 41 },
    spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 1 }, 3: { max: 3, used: 0 } },
    spells: [
      { lvl: 0, name: 'Druidcraft', school: 'Transmutation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Thorn Whip', school: 'Transmutation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Entangle', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 1, name: 'Healing Word', school: 'Abjuration', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Barkskin', school: 'Transmutation', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Aid', school: 'Abjuration', time: '1 action', prepared: false },
      { lvl: 3, name: 'Call Lightning', school: 'Conjuration', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: 'Quarterstaff', dmg: '1d6+2 bludgeoning', notes: 'Versatile (1d8)' },
    ],
    gear: [
      { name: 'Leather Armor', equipped: true },
      { name: 'Shield', equipped: true },
      { name: 'Druidic Focus (carved antler)' },
    ],
    features: [
      { name: 'Primal Order', source: 'Druid 1', desc: 'Warden: martial weapons and medium armor training.' },
      { name: 'Wild Shape', source: 'Druid 2', desc: 'Magically take a beast form a few times per rest.' },
      { name: 'Circle Forms', source: 'Moon 3', desc: 'Wild Shape into tougher beasts; temp HP on transforming.' },
      { name: 'Wild Resurgence', source: 'Druid 5', desc: 'Trade spell slots and Wild Shape uses.' },
    ],
    traits: {
      Personality: 'Slow to speak, slower to anger, impossible to move once planted.',
      Ideals: 'Balance. The land gives, and the land must be given back to.',
      Bonds: 'The Cenarion Circle, who taught him the bear and the cat.',
      Flaws: 'Trusts beasts more readily than people.',
    },
    bio: 'A plains wanderer who heard Ursoc in the thunder and took up the Guardian path, standing between his friends and whatever comes charging.',
    notes: '',
  },
  // World of Warcraft Paladin — an ordinary Paladin with the Holy specialization and the
  // WoW-only Oath of the Holy (chosen at level 3), so the always-prepared oath spells render.
  {
    id: 9,
    name: 'Aelira Dawnmantle',
    playerName: 'Ivy',
    player: 'Ivy',
    campaignId: null,
    race: 'Dwarf',
    clazz: 'Paladin',
    subclass: OATH_OF_THE_HOLY,
    specialization: 'Holy',
    level: 7,
    background: 'Acolyte',
    alignment: 'Lawful Good',
    portraitInitials: 'AD',
    portraitTint: 'gold',
    hp: { cur: 60, max: 60, temp: 0 },
    ac: 18, init: 0, speed: 30, prof: 3,
    stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 12, CHA: 16 },
    saves: ['WIS', 'CHA'],
    skills: { Insight: 'prof', Medicine: 'prof', Persuasion: 'prof', Religion: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 22, gp: 64 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 } },
    spells: [
      { lvl: 0, name: 'Sacred Flame', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Spare the Dying', school: 'Necromancy', time: '1 action', prepared: true },
      { lvl: 1, name: 'Bless', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Heroism', school: 'Enchantment', time: '1 action', prepared: false },
      { lvl: 1, name: 'Shield of Faith', school: 'Abjuration', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Aid', school: 'Abjuration', time: '1 action', prepared: true },
      { lvl: 2, name: 'Warding Bond', school: 'Abjuration', time: '1 action', prepared: false },
    ],
    weapons: [
      { name: 'Warhammer', dmg: '1d8+3 bludgeoning', notes: 'Versatile (1d10); mastery: Push' },
    ],
    gear: [
      { name: 'Chain Mail', equipped: true },
      { name: 'Shield', equipped: true },
      { name: 'Holy Symbol (Silver Hand)' },
    ],
    features: [
      { name: 'Weapon Mastery', source: 'Paladin 1', desc: 'Use the mastery properties of two kinds of weapons.' },
      { name: 'Lay On Hands', source: 'Paladin 1', desc: 'A pool of healing you restore on a Long Rest.' },
      { name: 'Fighting Style', source: 'Paladin 2', desc: 'Blessed Warrior: two Cleric cantrips cast with Charisma.' },
      { name: 'Extra Attack', source: 'Paladin 5', desc: 'Attack twice when you take the Attack action.' },
      { name: 'Aura of Protection', source: 'Paladin 6', desc: 'You and nearby allies add your CHA modifier to saving throws.' },
    ],
    traits: {
      Personality: 'Hums hymns under her breath, louder the worse things get.',
      Ideals: 'Mercy. The Light is for everyone who will take it.',
      Bonds: 'The chapel in Ironforge that took her in.',
      Flaws: 'Will heal a foe who begs, even when she should not.',
    },
    bio: 'A dwarf of the Silver Hand who would rather mend a wound than open one, though her warhammer says otherwise when it has to.',
    notes: '',
  },
  // World of Warcraft Rogue — an ordinary Rogue with the Outlaw specialization and the
  // WoW-only Swashbuckler (chosen at level 3), so the rogue panel and header render.
  {
    id: 10,
    name: 'Vex Saltbrand',
    playerName: 'Jack',
    player: 'Jack',
    campaignId: null,
    race: 'Human',
    clazz: 'Rogue',
    subclass: SWASHBUCKLER,
    specialization: 'Outlaw',
    level: 9,
    background: 'Sailor',
    alignment: 'Chaotic Neutral',
    portraitInitials: 'VS',
    portraitTint: 'crimson',
    hp: { cur: 66, max: 66, temp: 0 },
    ac: 16, init: 4, speed: 30, prof: 4,
    stats: { STR: 10, DEX: 18, CON: 14, INT: 12, WIS: 10, CHA: 16 },
    saves: ['DEX', 'INT'],
    skills: { Acrobatics: 'expert', Persuasion: 'expert', Athletics: 'prof', Deception: 'prof', Perception: 'prof', Sleight: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 31, gp: 175 },
    weapons: [
      { name: 'Rapier', dmg: '1d8+4 piercing', notes: 'Finesse; mastery: Vex' },
      { name: 'Dagger', dmg: '1d4+4 piercing', notes: 'Finesse, light, thrown (20/60); mastery: Nick' },
    ],
    gear: [
      { name: 'Studded Leather', equipped: true },
      { name: "Thieves' Tools" },
      { name: 'Spyglass (Booty Bay brass)' },
    ],
    features: [
      { name: 'Sneak Attack', source: 'Rogue 1', desc: '+5d6 once per turn with advantage or an ally adjacent.' },
      { name: 'Weapon Mastery', source: 'Rogue 1', desc: 'Use the mastery properties of two kinds of weapons.' },
      { name: 'Cunning Action', source: 'Rogue 2', desc: 'Bonus action: Dash, Disengage, or Hide.' },
      { name: 'Fancy Footwork', source: 'Swashbuckler 3', desc: 'A creature you attack in melee cannot make Opportunity Attacks against you this turn.' },
      { name: 'Rakish Audacity', source: 'Swashbuckler 3', desc: 'Add CHA to Initiative; Sneak Attack a lone foe without needing advantage.' },
      { name: 'Cunning Strike', source: 'Rogue 5', desc: 'Trade Sneak Attack dice for effects such as Poison or Trip.' },
      { name: 'Uncanny Dodge', source: 'Rogue 5', desc: 'Halve damage from an attack you can see.' },
      { name: 'Evasion', source: 'Rogue 7', desc: 'Take no damage on a successful DEX save against area effects.' },
      { name: 'Panache', source: 'Swashbuckler 9', desc: 'Charm or goad a creature with a Persuasion contest.' },
    ],
    traits: {
      Personality: 'Bows to every opponent, then cheats anyway.',
      Ideals: 'Freedom. No flag, no crown, no master.',
      Bonds: 'The crew of the Saltwind, wherever the tide took them.',
      Flaws: 'Cannot walk away from a wager or a dare.',
    },
    bio: 'A Booty Bay deckhand turned duelist, who talks as fast as she fights and has never once paid full price for anything.',
    notes: '',
  },
  // World of Warcraft Shaman (Barbarian) — an ordinary Barbarian with the Elemental
  // specialization and the WoW-only Path of the Elements, so the Totems and Raging
  // Elements cards and the "Shaman (Barbarian)" header render.
  {
    id: 11,
    name: 'Durak Stormcaller',
    playerName: 'Kara',
    player: 'Kara',
    campaignId: null,
    race: 'Orc',
    clazz: 'Barbarian',
    subclass: PATH_OF_THE_ELEMENTS,
    specialization: 'Elemental',
    level: 10,
    background: 'Hermit',
    alignment: 'Neutral Good',
    portraitInitials: 'DS',
    portraitTint: 'celestial',
    hp: { cur: 105, max: 105, temp: 0 },
    ac: 16, init: 2, speed: 40, prof: 4,
    stats: { STR: 16, DEX: 14, CON: 16, INT: 8, WIS: 14, CHA: 10 },
    saves: ['STR', 'CON'],
    skills: { Athletics: 'prof', Nature: 'prof', Perception: 'prof', Survival: 'prof' },
    conditions: [],
    coins: { cp: 12, sp: 20, gp: 74 },
    spellSlots: {},
    spells: [],
    weapons: [
      { name: 'Battleaxe', dmg: '1d8+3 slashing', notes: 'Versatile (1d10); mastery: Topple' },
      { name: 'Mace', dmg: '1d6+3 bludgeoning', notes: 'Mastery: Sap' },
    ],
    gear: [
      { name: 'Scale Mail', equipped: true },
      { name: 'Shield', equipped: true },
      { name: 'Totem bundle (earth, fire, water, air)' },
    ],
    features: [
      { name: 'Rage', source: 'Barbarian 1', desc: 'Bonus action; 4 uses per long rest. +3 dmg, advantage on STR.' },
      { name: 'Weapon Mastery', source: 'Barbarian 1', desc: 'Use the mastery properties of two kinds of weapons.' },
      { name: 'Reckless Attack', source: 'Barbarian 2', desc: 'Trade defense for advantage on STR attacks.' },
      { name: 'Totems', source: 'Barbarian 3', desc: 'Replaces Primal Knowledge. Plant a totem that pulses in a 30-ft. emanation.' },
      { name: 'Raging Elements', source: 'Path of the Elements 3', desc: 'Unleash Icefury, Lava Burst, or Lightning Bolt.' },
      { name: 'Extra Attack', source: 'Barbarian 5', desc: 'Attack twice when you take the Attack action.' },
      { name: 'Echo of the Elements', source: 'Path of the Elements 6', desc: 'Elementalism; spend a Rage for Daylight, Water Walk, or Wind Wall.' },
      { name: 'Feral Instinct', source: 'Barbarian 7', desc: "Advantage on initiative. Surprise doesn't stop you from raging." },
      { name: 'Brutal Strike', source: 'Barbarian 9', desc: 'Forgo Advantage from Reckless Attack for extra damage and an effect.' },
      { name: 'Primordial Bond', source: 'Path of the Elements 10', desc: 'Resistance to Cold, Fire, and Lightning while raging.' },
    ],
    traits: {
      Personality: 'Listens to the wind before answering anyone.',
      Ideals: 'Balance. Every storm must end, and every fire must be fed.',
      Bonds: 'The Earthen Ring, who taught him to hear the elements.',
      Flaws: 'Trusts the spirits more than people.',
    },
    bio: 'An orc of the Earthen Ring who left Orgrimmar to calm the restless elements of the Barrens, and still carries the smell of rain wherever he goes.',
    notes: '',
  },
  // World of Warcraft Warlock — an ordinary Warlock with the Demonology specialization
  // and the Fiend Patron (picked at level 1), so the warlock panel, its invocation
  // recommendations and the "Warlock (Fiend Patron · Demonology)" header render.
  {
    id: 12,
    name: 'Nixa Cinderwhisk',
    playerName: 'Mira',
    player: 'Mira',
    campaignId: null,
    race: 'Gnome',
    clazz: 'Warlock',
    subclass: FIEND_PATRON,
    specialization: 'Demonology',
    level: 5,
    background: 'Charlatan',
    alignment: 'Chaotic Neutral',
    portraitInitials: 'NC',
    portraitTint: 'violet',
    hp: { cur: 38, max: 38, temp: 0 },
    ac: 13, init: 2, speed: 30, prof: 3,
    stats: { STR: 8, DEX: 14, CON: 14, INT: 12, WIS: 10, CHA: 18 },
    saves: ['WIS', 'CHA'],
    skills: { Arcana: 'prof', Deception: 'prof', Intimidation: 'prof', Sleight: 'prof' },
    conditions: [],
    coins: { cp: 4, sp: 12, gp: 63 },
    spellSlots: { 3: { max: 2, used: 0 } },
    spells: [
      { lvl: 0, name: 'Eldritch Blast', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Toll the Dead', school: 'Necromancy', time: '1 action', prepared: true },
      { lvl: 1, name: 'Hex', school: 'Enchantment', time: '1 bonus action', prepared: true },
      { lvl: 1, name: 'Arms of Hadar', school: 'Conjuration', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: 'Dagger', dmg: '1d4+2 piercing', notes: 'Finesse, light, thrown (20/60)' },
    ],
    gear: [
      { name: 'Leather Armor', equipped: true },
      { name: 'Arcane Focus (fel-green crystal)' },
      { name: 'Soul shards (3, in a lead box)' },
    ],
    features: [
      { name: 'Eldritch Invocations', source: 'Warlock 1', desc: 'Pact of the Legion, Health Funnel, Repelling Blast, Legion Summoning, Master Demonologist.' },
      { name: 'Pact Magic', source: 'Warlock 1', desc: 'Two level-3 spell slots that return on a Short or Long Rest.' },
      { name: "Dark One's Blessing", source: 'Fiend 1', desc: 'Gain temporary HP when you reduce an enemy to 0 HP.' },
      { name: 'Magical Cunning', source: 'Warlock 2', desc: 'Once per Long Rest, regain half your Pact Magic slots with a 1-minute rite.' },
    ],
    traits: {
      Personality: 'Talks to her imp more kindly than to most people.',
      Ideals: "Power. The Legion's own fire is the best weapon against it.",
      Bonds: 'The gnomes who never made it out of Gnomeregan.',
      Flaws: 'Certain she can always renegotiate the terms.',
    },
    bio: 'A gnome tinkerer who found a demonic contract in the rubble of Gnomeregan, signed it, and has been bending its fine print against the Burning Legion ever since.',
    notes: '',
  },
  // World of Warcraft Warrior (Fighter) — an ordinary Fighter with the Protection
  // specialization and the Battle Master subclass, so the "Warrior (Fighter)" header,
  // the maneuver recommendations and the Battle Master card (5 × d8 at level 7) render.
  {
    id: 13,
    name: 'Karsha Stonehelm',
    playerName: 'Owen',
    player: 'Owen',
    campaignId: null,
    race: 'Orc',
    clazz: 'Fighter',
    subclass: BATTLE_MASTER,
    specialization: 'Protection',
    level: 7,
    background: 'Soldier',
    alignment: 'Lawful Neutral',
    portraitInitials: 'KS',
    portraitTint: 'crimson',
    hp: { cur: 67, max: 67, temp: 0 },
    ac: 18, init: 1, speed: 30, prof: 3,
    stats: { STR: 17, DEX: 12, CON: 16, INT: 8, WIS: 12, CHA: 10 },
    saves: ['STR', 'CON'],
    skills: { Athletics: 'prof', Intimidation: 'prof', Perception: 'prof', Survival: 'prof' },
    conditions: [],
    coins: { cp: 8, sp: 15, gp: 52 },
    spellSlots: {},
    spells: [],
    weapons: [
      { name: 'Longsword', dmg: '1d8+3 slashing', notes: 'Versatile (1d10); mastery: Sap' },
      { name: 'Battleaxe', dmg: '1d8+3 slashing', notes: 'Versatile (1d10); mastery: Topple' },
      { name: 'Javelin', dmg: '1d6+3 piercing', notes: 'Thrown (30/120); mastery: Slow' },
    ],
    gear: [
      { name: 'Chain Mail', equipped: true },
      { name: 'Shield (Horde crest)', equipped: true },
      { name: 'War horn' },
    ],
    features: [
      { name: 'Fighting Style', source: 'Fighter 1', desc: 'Protection: impose disadvantage on an attack against an ally within 5 feet while holding a Shield.' },
      { name: 'Second Wind', source: 'Fighter 1', desc: 'Bonus action to regain 1d10 + fighter level HP; 3 uses, one back on a Short Rest.' },
      { name: 'Weapon Mastery', source: 'Fighter 1', desc: 'Use the mastery properties of four kinds of weapons.' },
      { name: 'Action Surge', source: 'Fighter 2', desc: 'Take one additional action once per Short or Long Rest.' },
      { name: 'Tactical Mind', source: 'Fighter 2', desc: 'Spend a Second Wind use to add 1d10 to a failed ability check.' },
      { name: 'Combat Superiority', source: 'Battle Master 3', desc: 'Maneuvers: Battle Shout, Demoralizing Shout, Goading Attack, Parry, Warding Maneuver.' },
      { name: 'Student of War', source: 'Battle Master 3', desc: "Proficiency with Smith's Tools and one more fighter skill." },
      { name: 'Heavy Armor Master', source: 'Fighter 4', desc: 'Reduce bludgeoning, piercing, and slashing damage you take by your Proficiency Bonus while in heavy armor.' },
      { name: 'Extra Attack', source: 'Fighter 5', desc: 'Attack twice when you take the Attack action.' },
      { name: 'Tactical Shift', source: 'Fighter 5', desc: 'Move half your speed without provoking when you use Second Wind.' },
      { name: 'Sentinel', source: 'Fighter 6', desc: 'Opportunity attacks stop movement; punish foes that strike your allies.' },
      { name: 'Know Your Enemy', source: 'Battle Master 7', desc: "Bonus action to learn a creature's immunities, resistances, and vulnerabilities." },
    ],
    traits: {
      Personality: 'Says little, and always stands where the blow will land.',
      Ideals: 'Duty. The line holds because I hold it.',
      Bonds: 'The Horde garrison she trained, and every recruit who came home.',
      Flaws: 'Treats every retreat as a personal failure.',
    },
    bio: 'An orc shieldbearer who held the gate of a Durotar outpost through a three-day siege, and has carried the dented shield from that wall ever since.',
    notes: '',
  },
  // World of Warcraft Priest (Cleric) — an ordinary Cleric with the Shadow specialization
  // and the WoW-only Shadow Domain (chosen at level 3), so the "Priest (Cleric)" header,
  // the Shadow Domain spells and the Shadowform / Devouring Plague / Dispersion card render.
  {
    id: 14,
    name: 'Ilyara Duskwhisper',
    playerName: 'Nora',
    player: 'Nora',
    campaignId: null,
    race: 'Elf',
    clazz: 'Cleric',
    subclass: SHADOW_DOMAIN,
    specialization: 'Shadow',
    level: 6,
    background: 'Acolyte',
    alignment: 'Neutral',
    portraitInitials: 'ID',
    portraitTint: 'violet',
    hp: { cur: 45, max: 45, temp: 0 },
    ac: 15, init: 2, speed: 30, prof: 3,
    stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 17, CHA: 13 },
    saves: ['WIS', 'CHA'],
    skills: { Insight: 'prof', Medicine: 'prof', Persuasion: 'prof', Religion: 'prof' },
    conditions: [],
    coins: { cp: 6, sp: 22, gp: 48 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 3, used: 0 } },
    spells: [
      { lvl: 0, name: 'Mending', school: 'Transmutation', time: '1 minute', prepared: true },
      { lvl: 0, name: 'Resistance', school: 'Abjuration', time: '1 action', prepared: true },
      { lvl: 0, name: 'Thaumaturgy', school: 'Transmutation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Toll the Dead', school: 'Necromancy', time: '1 action', prepared: true },
      { lvl: 1, name: 'Bane', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Command', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Healing Word', school: 'Abjuration', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Blur', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 2, name: 'Hold Person', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 2, name: 'Silence', school: 'Illusion', time: '1 action', prepared: false },
      { lvl: 3, name: 'Speak with Dead', school: 'Necromancy', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: 'Mace', dmg: '1d6-1 bludgeoning', notes: 'Mastery: Sap' },
    ],
    gear: [
      { name: 'Chain Shirt', equipped: true },
      { name: 'Holy Symbol (a moonstone gone dark)' },
      { name: 'Prayer beads of violet glass' },
    ],
    features: [
      { name: 'Divine Order', source: 'Cleric 1', desc: 'Thaumaturge: one extra cantrip, and add your Wisdom modifier to Arcana and Religion checks.' },
      { name: 'Channel Divinity', source: 'Cleric 2', desc: 'Divine Spark or Turn Undead; 3 uses, one back on a Short Rest.' },
      { name: 'Shadowform', source: 'Shadow Domain 3', desc: 'Channel Divinity: wrap yourself in shadow for 1 minute.' },
      { name: 'Devouring Plague', source: 'Shadow Domain 3', desc: 'Drain 1d10 Necrotic from a foe and heal that much.' },
      { name: 'Telepathic', source: 'Cleric 4', desc: 'Speak mind to mind within 60 feet; cast Detect Thoughts once per Long Rest.' },
      { name: 'Sear Undead', source: 'Cleric 5', desc: 'Turn Undead also deals Radiant damage to the Undead it affects.' },
      { name: 'Dispersion', source: 'Shadow Domain 6', desc: 'Reaction: dissolve into shadow and shrug off harm.' },
    ],
    traits: {
      Personality: 'Speaks softly, and always seems to know what you were about to say.',
      Ideals: 'Balance. The Light alone could not save Teldrassil; the Shadow will have its turn.',
      Bonds: 'The sisters of Elune who still pray for her return.',
      Flaws: 'Hears whispers in the dark, and has started answering them.',
    },
    bio: 'A night elf priestess of Elune who lost her temple to fire and found that the Void listened when the moon did not. She still wears the moonstone, though it no longer shines.',
    notes: '',
  },
  // World of Warcraft Evoker (Sorcerer) — a Sorcerer locked to Draconic Sorcery with the
  // Devastation specialization, so the "Evoker (Sorcerer)" header and the Evoker Spells
  // (Sorcerer 3 and 5 rows) render. Dragonborn stands in for a dracthyr.
  {
    id: 15,
    name: 'Kazrethos Emberwing',
    playerName: 'Omar',
    player: 'Omar',
    campaignId: null,
    race: 'Dragonborn',
    clazz: 'Sorcerer',
    subclass: DRACONIC_SORCERY,
    specialization: 'Devastation',
    level: 5,
    background: 'Sage',
    alignment: 'Neutral Good',
    portraitInitials: 'KE',
    portraitTint: 'crimson',
    hp: { cur: 37, max: 37, temp: 0 },
    ac: 15, init: 2, speed: 30, prof: 3,
    stats: { STR: 10, DEX: 14, CON: 14, INT: 12, WIS: 10, CHA: 18 },
    saves: ['CON', 'CHA'],
    skills: { Arcana: 'prof', History: 'prof', Intimidation: 'prof', Insight: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 14, gp: 52 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
    spells: [
      { lvl: 0, name: 'Elementalism', school: 'Transmutation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Light', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Ray of Frost', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Sorcerous Burst', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Fire Bolt', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Burning Hands', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Ice Knife', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 1, name: 'Living Flame', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 2, name: 'Arcane Vigor', school: 'Abjuration', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Cloud of Daggers', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 2, name: 'Flame Blade', school: 'Evocation', time: '1 bonus action', prepared: false },
      { lvl: 3, name: 'Counterspell', school: 'Abjuration', time: '1 reaction', prepared: true },
      { lvl: 3, name: 'Sleet Storm', school: 'Conjuration', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: 'Dagger', dmg: '1d4+2 piercing', notes: 'Finesse, Light, Thrown' },
    ],
    gear: [
      { name: 'Arcane Focus (a scale of the red flight)' },
      { name: "Scholar's Pack" },
    ],
    features: [
      { name: 'Innate Sorcery', source: 'Sorcerer 1', desc: 'Bonus Action: for 1 minute, +1 spell save DC and Advantage on sorcerer spell attacks.' },
      { name: 'Draconic Resilience', source: 'Draconic Sorcery 1', desc: 'Extra Hit Points, and AC 10 + DEX + CHA without armor.' },
      { name: 'Font of Magic', source: 'Sorcerer 2', desc: 'Sorcery Points to fuel Metamagic and create spell slots.' },
      { name: 'Metamagic', source: 'Sorcerer 2', desc: 'Empowered Spell and Transmuted Spell.' },
      { name: 'Evoker Spells', source: 'Sorcerer 3', desc: 'Always-prepared Evoker spells for your specialization.' },
      { name: 'Sorcerous Restoration', source: 'Sorcerer 5', desc: 'Regain some Sorcery Points on a Short Rest.' },
    ],
    traits: {
      Personality: 'Talks fast, flies faster, and treats every problem as something to be breathed on.',
      Ideals: 'Purpose. The dracthyr were made for war; Kazrethos means to choose what that war is for.',
      Bonds: 'The Obsidian Warders who woke beside him on the Forbidden Reach.',
      Flaws: 'Forgets that most people cannot shrug off a blast of flame.',
    },
    bio: 'A dracthyr evoker who woke after ages of slumber and found the world had moved on. He channels red and blue dragonfire, and is still learning which of his new allies flinch at it.',
    notes: '',
  },
  // World of Warcraft Hunter (Ranger) — an ordinary Ranger with the Beast Mastery
  // specialization and the Beast Master subclass, with a Wolf pet, so the "Hunter (Ranger)"
  // header, the Pet card and the level-6 Pet Specialization (Ferocity) render.
  {
    id: 16,
    name: 'Rhonna Stoneclaw',
    playerName: 'Pia',
    player: 'Pia',
    campaignId: null,
    race: 'Dwarf',
    clazz: 'Ranger',
    subclass: BEAST_MASTER,
    specialization: 'Beast Mastery',
    petFamily: 'Wolf',
    level: 6,
    background: 'Guide',
    alignment: 'Neutral Good',
    portraitInitials: 'RS',
    portraitTint: 'emerald',
    hp: { cur: 55, max: 55, temp: 0 },
    ac: 15, init: 3, speed: 30, prof: 3,
    stats: { STR: 12, DEX: 16, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    saves: ['STR', 'DEX'],
    skills: { 'Animal Handling': 'prof', Perception: 'prof', Stealth: 'prof', Survival: 'expert' },
    conditions: [],
    coins: { cp: 12, sp: 30, gp: 58 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } },
    spells: [
      { lvl: 1, name: 'Ensnaring Strike', school: 'Conjuration', time: '1 bonus action', prepared: true },
      { lvl: 1, name: 'Speak with Animals', school: 'Divination', time: '1 action', prepared: true },
      { lvl: 1, name: "Hunter's Mark", school: 'Divination', time: '1 bonus action', prepared: true },
      { lvl: 1, name: 'Freezing Trap', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 2, name: 'Beast Sense', school: 'Divination', time: '1 action', prepared: true },
      { lvl: 2, name: 'Summon Beast', school: 'Conjuration', time: '1 action', prepared: false },
    ],
    weapons: [
      { name: 'Heavy Crossbow', dmg: '1d10+3 piercing', notes: 'Mastery: Push' },
      { name: 'Longbow', dmg: '1d8+3 piercing', notes: 'Mastery: Slow' },
    ],
    gear: [
      { name: 'Scale Mail', equipped: true },
      { name: 'Quiver of bolts' },
      { name: 'Wolf-fang charm' },
    ],
    features: [
      { name: 'Weapon Mastery', source: 'Ranger 1', desc: 'Heavy Crossbows and Longbows.' },
      { name: 'Fighting Style', source: 'Ranger 2', desc: 'Archery.' },
      { name: 'Primal Companion', source: 'Beast Master 3', desc: 'A Beast of the Land companion: her wolf, Ashmane.' },
      { name: 'Extra Attack', source: 'Ranger 5', desc: 'Attack twice when you take the Attack action.' },
      { name: 'Pet Specialization', source: 'Ranger 6', desc: 'Ferocity: Bloodied healing on Beast\'s Strike hits, and Haste once per Long Rest.' },
    ],
    traits: {
      Personality: 'Says more to her wolf in a glance than to most people in a day.',
      Ideals: 'Loyalty. A pack looks after its own.',
      Bonds: 'Ashmane, the wolf she raised from a pup in the snows of Dun Morogh.',
      Flaws: 'Trusts a beast\'s growl over a stranger\'s smile, every time.',
    },
    bio: 'A dwarven hunter from the hills of Dun Morogh who never goes anywhere without Ashmane, the grey wolf at her side.',
    notes: '',
  },
  // World of Warcraft Mage (Wizard) — an ordinary Wizard with the Frost specialization and
  // the PHB Evoker subclass (the school of evocation), so the "Mage (Wizard)" header, the
  // suggested Frost spells (Frost Nova ✦ known) and the Kirin Tor renown note render.
  {
    id: 17,
    name: 'Elandra Frostmantle',
    playerName: 'Quinn',
    player: 'Quinn',
    campaignId: null,
    race: 'Human',
    clazz: 'Wizard',
    subclass: EVOKER_SCHOOL,
    specialization: 'Frost',
    level: 5,
    background: 'Sage',
    alignment: 'Lawful Neutral',
    portraitInitials: 'EF',
    portraitTint: 'celestial',
    hp: { cur: 27, max: 27, temp: 0 },
    ac: 12, init: 2, speed: 30, prof: 3,
    stats: { STR: 8, DEX: 14, CON: 13, INT: 18, WIS: 12, CHA: 10 },
    saves: ['INT', 'WIS'],
    skills: { Arcana: 'prof', History: 'prof', Investigation: 'prof', Insight: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 18, gp: 64 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
    spells: [
      { lvl: 0, name: 'Light', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Mage Hand', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 0, name: 'Ray of Frost', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 0, name: 'Fire Bolt', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Frost Nova', school: 'Evocation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Ice Knife', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 1, name: 'Mage Armor', school: 'Abjuration', time: '1 action', prepared: true },
      { lvl: 1, name: 'Shield', school: 'Abjuration', time: '1 reaction', prepared: true },
      { lvl: 1, name: 'Detect Magic', school: 'Divination', time: '1 action', prepared: false },
      { lvl: 1, name: 'Feather Fall', school: 'Abjuration', time: '1 reaction', prepared: false },
      { lvl: 2, name: 'Misty Step', school: 'Conjuration', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Mirror Image', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 3, name: 'Counterspell', school: 'Abjuration', time: '1 reaction', prepared: true },
      { lvl: 3, name: 'Sleet Storm', school: 'Conjuration', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: 'Quarterstaff', dmg: '1d6-1 bludgeoning', notes: 'Mastery: Topple' },
    ],
    gear: [
      { name: 'Spellbook (violet leather, Kirin Tor seal)' },
      { name: 'Arcane Focus (a frost-rimed crystal)' },
      { name: "Scholar's Pack" },
    ],
    features: [
      { name: 'Arcane Recovery', source: 'Wizard 1', desc: 'Once per day on a Short Rest, recover expended spell slots.' },
      { name: 'Ritual Adept', source: 'Wizard 1', desc: 'Cast ritual spells from your spellbook without preparing them.' },
      { name: 'Scholar', source: 'Wizard 2', desc: 'Expertise in one of Arcana, History, Investigation, Medicine, Nature, or Religion.' },
      { name: 'Evocation Savant', source: 'Evoker 3', desc: 'Add two Evocation spells to your spellbook for free.' },
      { name: 'Potent Cantrip', source: 'Evoker 3', desc: 'Your damaging cantrips deal half damage even when they miss or the target saves.' },
      { name: 'Memorize Spell', source: 'Wizard 5', desc: 'After a Short Rest, swap one prepared spell for another from your spellbook.' },
    ],
    traits: {
      Personality: 'Measures every problem twice and every person three times.',
      Ideals: 'Discipline. Magic without restraint is how the Legion found its way in.',
      Bonds: 'The Violet Citadel of Dalaran, and the tutor who vouched for her there.',
      Flaws: 'Freezes a room long before she thinks to talk to it.',
    },
    bio: 'A human mage of the Kirin Tor, trained in the spires of Dalaran, who favours frost because it ends fights without burning down the library.',
    notes: '',
  },
  // World of Warcraft Monk — an ordinary Monk with the Brewmaster specialization and the
  // WoW-only Warrior of Mystic Brews (chosen at level 3), so the "Monk" header, the
  // monastic-orders lore and the Mystic Brew card (Monk 6) render. Goliath stands in
  // for a pandaren.
  {
    id: 18,
    name: 'Bao Emberbrew',
    playerName: 'Ravi',
    player: 'Ravi',
    campaignId: null,
    race: 'Goliath',
    clazz: 'Monk',
    subclass: WARRIOR_OF_MYSTIC_BREWS,
    specialization: 'Brewmaster',
    level: 6,
    background: 'Artisan',
    alignment: 'Neutral Good',
    portraitInitials: 'BE',
    portraitTint: 'gold',
    hp: { cur: 45, max: 45, temp: 0 },
    ac: 16, init: 3, speed: 45, prof: 3,
    stats: { STR: 12, DEX: 16, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    saves: ['STR', 'DEX'],
    skills: { Acrobatics: 'prof', Insight: 'prof', Performance: 'prof', Persuasion: 'prof' },
    conditions: [],
    coins: { cp: 10, sp: 25, gp: 30 },
    spells: [],
    weapons: [
      { name: 'Unarmed Strike', dmg: '1d8+3 bludgeoning', notes: 'Martial Arts' },
      { name: 'Quarterstaff', dmg: '1d8+3 bludgeoning', notes: 'Mastery: Topple' },
    ],
    gear: [
      { name: "Brewer's Supplies", equipped: true },
      { name: 'Keg-shaped gourd of stout' },
      { name: "Explorer's Pack" },
    ],
    features: [
      { name: 'Martial Arts', source: 'Monk 1', desc: 'Unarmed Strikes use your Martial Arts die (d8 at Monk 6).' },
      { name: 'Unarmored Defense', source: 'Monk 1', desc: 'AC 10 + DEX + WIS without armor or a shield.' },
      { name: "Monk's Focus", source: 'Monk 2', desc: '6 Focus Points for Flurry of Blows, Patient Defense and Step of the Wind.' },
      { name: 'Deflect Attacks', source: 'Monk 3', desc: 'Reaction: reduce damage from an attack that hits you.' },
      { name: 'Bonus Proficiencies', source: 'Warrior of Mystic Brews 3', desc: "Performance and Brewer's Supplies." },
      { name: 'Drunken Technique', source: 'Warrior of Mystic Brews 3', desc: 'Patient Defense with Focus adds 10 ft. of Speed and an Unarmed Strike.' },
      { name: 'Slow Fall', source: 'Monk 4', desc: 'Reaction: reduce falling damage.' },
      { name: 'Extra Attack', source: 'Monk 5', desc: 'Attack twice when you take the Attack action.' },
      { name: 'Stunning Strike', source: 'Monk 5', desc: 'Spend 1 Focus Point on a hit to try to Stun the target.' },
      { name: 'Empowered Strikes', source: 'Monk 6', desc: 'Your Unarmed Strikes can deal Force damage.' },
      { name: 'Tipsy Sway', source: 'Warrior of Mystic Brews 6', desc: 'Leap to your feet, and redirect a missed melee attack.' },
      { name: 'Mystic Brew', source: 'Warrior of Mystic Brews 6', desc: 'Brew a magical beverage after a rest.' },
    ],
    traits: {
      Personality: 'Laughs loudest at his own jokes, and sways like a reed in every fight.',
      Ideals: 'Balance. A good brew, like a good life, needs a little of everything.',
      Bonds: 'The Stormstout brewery, and the master who taught him to brew and to brawl.',
      Flaws: 'Will stop mid-quest to sample any brew he has never tasted.',
    },
    bio: 'A wandering brewmaster in the pandaren tradition who learned to fight from a brewery-keeper of the Valley of the Four Winds, and has never met a keg he could not lift or a punch he could not stagger away from.',
    notes: '',
  },
];

// ---------------------------------------------------------------------------
// Demo activity log seed — a few plausible recent entries per demo PC, newest
// first, so the Log tab isn't empty when the demo boots. Mirrors the backend's
// pre-rendered display-string convention; not an audit of anything real.
// ---------------------------------------------------------------------------
export const DEMO_ACTIVITY_LOGS: { [pcId: number]: PcActivityLogEntry[] } = {
  1: [
    { id: 'demo-1-4', pcId: 1, actionType: 'DM_EDIT', description: 'DM changed AC 14 → 15',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
    { id: 'demo-1-3', pcId: 1, actionType: 'PURCHASE', description: 'Bought Potion of Healing for 50 gp',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
    { id: 'demo-1-2', pcId: 1, actionType: 'XP_AWARD', description: 'Awarded 450 XP',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    { id: 'demo-1-1', pcId: 1, actionType: 'LEVEL_UP', description: 'Leveled up to 7',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
  ],
  2: [
    { id: 'demo-2-3', pcId: 2, actionType: 'LONG_REST', description: 'Completed a long rest',
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
    { id: 'demo-2-2', pcId: 2, actionType: 'DM_EDIT', description: 'DM added feature Darkvision',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
    { id: 'demo-2-1', pcId: 2, actionType: 'SALE', description: 'Sold Handaxe for 2 gp 5 sp',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString() },
  ],
  5: [
    { id: 'demo-5-4', pcId: 5, actionType: 'XP_AWARD', description: 'Awarded 300 XP',
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString() },
    { id: 'demo-5-3', pcId: 5, actionType: 'PURCHASE', description: 'Bought Caltrops (10) for 1 gp',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
    { id: 'demo-5-2', pcId: 5, actionType: 'LONG_REST', description: 'Completed a long rest',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
    { id: 'demo-5-1', pcId: 5, actionType: 'LEVEL_UP', description: 'Leveled up to 5',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() },
  ],
};

// ---------------------------------------------------------------------------
// Demo-mode level-up shim — pure helpers.
//
// UI-only mock so the modal can be exercised without a backend. This is NOT the
// rules engine — the authoritative D&D math lives server-side. It mirrors just
// enough (fixed-average HP, proficiency bonus, slot/feat/spell tables) to render
// a believable demo, and reuses the existing display-math helpers rather than
// holding its own. The stateful orchestration (computeDemoPreview / applyDemoLevelUp)
// stays in PCService — only the pure functions live here.
// ---------------------------------------------------------------------------

export function demoProfBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

export function demoLevelUpFields(pc: PC) {
  const current = pc.level ?? 1;
  const hitDie = hitDieFor(pc.clazz);
  const conMod = modFromScore(pc.stats?.CON ?? 10);
  const hpGained = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
  return { current, newLevel: current + 1, hitDie, conMod, hpGained };
}

// The class slot tables (full casters, the half casters Paladin and Ranger, Warlock pact
// magic) live in utils/spell-slots.ts, the app's one copy of the server's ClassProgression
// tables. The demo level-up reads them through this name.
export function demoSlotsFor(clazz: string, level: number): { [lvl: number]: number } {
  return classSlotTable(clazz, level);
}

export function demoCurrentMaxSlots(pc: PC): { [lvl: number]: number } {
  const out: { [lvl: number]: number } = {};
  Object.entries(pc.spellSlots ?? {}).forEach(([lvl, slot]) => { out[Number(lvl)] = slot.max; });
  return out;
}

// DEMO-ONLY mirror of the server subclass grant levels (sorcerer/warlock = 1, else = 3).
// The subclass catalog is empty server-side (mechanism only), so the demo offers no options
// either — the picker never shows. Kept for parity if catalog content is added later.
export function demoSubclassLevel(clazz: string): number {
  return ['sorcerer', 'warlock'].includes((clazz ?? '').trim().toLowerCase()) ? 1 : 3;
}

// DEMO-ONLY mirror of the server SUBCLASS_CATALOG (2024 PHB subclass names,
// plus Twilight Domain from Tasha's Cauldron of Everything).
const DEMO_SUBCLASSES: { [clazz: string]: string[] } = {
  barbarian: ['Path of the Berserker', 'Path of the Wild Heart', 'Path of the World Tree', 'Path of the Zealot'],
  bard: ['College of Dance', 'College of Glamour', 'College of Lore', 'College of Valor'],
  cleric: ['Life Domain', 'Light Domain', 'Trickery Domain', 'Twilight Domain', 'War Domain'],
  druid: ['Circle of the Land', 'Circle of the Moon', 'Circle of the Sea', 'Circle of the Stars'],
  fighter: ['Battle Master', 'Champion', 'Eldritch Knight', 'Psi Warrior'],
  monk: ['Warrior of Mercy', 'Warrior of Shadow', 'Warrior of the Elements', 'Warrior of the Open Hand'],
  paladin: ['Oath of Devotion', 'Oath of Glory', 'Oath of the Ancients', 'Oath of Vengeance'],
  ranger: ['Beast Master', 'Fey Wanderer', 'Gloom Stalker', 'Hunter'],
  rogue: ['Arcane Trickster', 'Assassin', 'Soulknife', 'Thief'],
  wizard: ['Abjurer', 'Diviner', 'Evoker', 'Illusionist'],
};

// Plus each WoW variant's WoW-only subclasses (Oath of the Holy, Swashbuckler, the two
// WoW barbarian paths), offered
// only to that variant's characters (base class + one of its specializations).
export function demoSubclassOptions(clazz: string, specialization?: string | null): string[] {
  const key = (clazz ?? '').trim().toLowerCase();
  const options = DEMO_SUBCLASSES[key] ?? [];
  const variant = WOW_CLASS_VARIANTS.find(v => v.baseClass.toLowerCase() === key
    && v.specializations.some(s => s.name === specialization));
  const extra = variant ? wowOnlySubclasses(variant) : [];
  return extra.length ? [...options, ...extra].sort((a, b) => a.localeCompare(b)) : options;
}

// DEMO-ONLY mirror of the server ASI levels (default 4/8/12/16/19; Fighter +6/14; Rogue +10).
export function demoIsAsiLevel(clazz: string, level: number): boolean {
  const key = (clazz ?? '').trim().toLowerCase();
  const levels = key === 'fighter' ? [4, 6, 8, 12, 14, 16, 19]
    : key === 'rogue' ? [4, 8, 10, 12, 16, 19]
      : [4, 8, 12, 16, 19];
  return levels.includes(level);
}

// DEMO-ONLY mirror of the server feat catalog (FeatCatalog).
export const DEMO_GENERAL_FEATS = [
  'Actor', 'Athlete', 'Charger', 'Chef', 'Crossbow Expert', 'Crusher',
  'Defensive Duelist', 'Dual Wielder', 'Durable', 'Elemental Adept', 'Fey Touched',
  'Grappler', 'Great Weapon Master', 'Heavily Armored', 'Heavy Armor Master',
  'Inspiring Leader', 'Keen Mind', 'Lightly Armored', 'Mage Slayer',
  'Martial Weapon Training', 'Medium Armor Master', 'Moderately Armored',
  'Mounted Combatant', 'Observant', 'Piercer', 'Poisoner', 'Polearm Master',
  'Resilient', 'Ritual Caster', 'Sentinel', 'Shadow Touched', 'Sharpshooter',
  'Shield Master', 'Skill Expert', 'Skulker', 'Slasher', 'Speedy', 'Spell Sniper',
  'Telekinetic', 'Telepathic', 'War Caster', 'Weapon Master',
];

// DEMO-ONLY mirror of the server Fighting Style feat list (classes with the
// Fighting Style feature: fighter, paladin, ranger).
export const DEMO_FIGHTING_STYLE_FEATS = [
  'Archery', 'Blind Fighting', 'Defense', 'Dueling', 'Great Weapon Fighting',
  'Interception', 'Protection', 'Thrown Weapon Fighting', 'Two-Weapon Fighting',
  'Unarmed Fighting',
];

// DEMO-ONLY mirror of the server level-2 Fighting Style choice: due at Paladin 2 and
// Ranger 2; the 10 PHB styles, plus Blessed Warrior for every paladin, Druidic Warrior
// for every ranger, and Void Warrior for a Demon Hunter ranger.
export function demoFightingStyleDue(clazz: string, newLevel: number): boolean {
  const key = (clazz ?? '').trim().toLowerCase();
  return newLevel === 2 && (key === 'paladin' || key === 'ranger');
}

export function demoFightingStyleOptions(clazz: string, subclass: string | undefined, newLevel: number): string[] {
  if (!demoFightingStyleDue(clazz, newLevel)) return [];
  const key = (clazz ?? '').trim().toLowerCase();
  const options = [...DEMO_FIGHTING_STYLE_FEATS];
  if (key === 'paladin') options.push(BLESSED_WARRIOR);
  if (key === 'ranger') options.push(DRUIDIC_WARRIOR);
  if (key === 'ranger' && subclass === DEMON_HUNTER_SUBCLASS) {
    options.push(VOID_WARRIOR);
  }
  return options.sort((a, b) => a.localeCompare(b));
}

// DEMO-ONLY mirror of the server Epic Boon feat list (level 19+).
export const DEMO_EPIC_BOONS = [
  'Boon of Combat Prowess', 'Boon of Dimensional Travel', 'Boon of Energy Resistance',
  'Boon of Fate', 'Boon of Fortitude', 'Boon of Irresistible Offense',
  'Boon of Recovery', 'Boon of Skill', 'Boon of Speed', 'Boon of Spell Recall',
  'Boon of Truesight', 'Boon of the Night Spirit',
];

// DEMO-ONLY mirror of FeatCatalog.featOptions: General feats (incl. the World of
// Warcraft mage feats, open to every class, and the WoW monk feats for anyone with
// DEX 13+ and WIS 13+) always, Fighting Style feats for classes with the Fighting
// Style feature, Epic Boons at 19+.
export function demoFeatOptions(clazz: string, newLevel: number, stats?: Partial<NonNullable<PC['stats']>>): string[] {
  const key = (clazz ?? '').trim().toLowerCase();
  const options = [...DEMO_GENERAL_FEATS, ...WOW_MAGE_FEATS.map(f => f.name)];
  if ((stats?.DEX ?? 0) >= 13 && (stats?.WIS ?? 0) >= 13) {
    options.push(...WOW_MONK_FEATS.map(f => f.name));
  }
  if (key === 'fighter' || key === 'paladin' || key === 'ranger') {
    options.push(...DEMO_FIGHTING_STYLE_FEATS);
  }
  if (newLevel >= 19) {
    options.push(...DEMO_EPIC_BOONS);
  }
  return options.sort((a, b) => a.localeCompare(b));
}

// DEMO-ONLY mirror of the server cantrips-known formula (base +1 at L4 +1 at L10).
export function demoCantripsKnown(clazz: string, level: number): number {
  const base: { [k: string]: number } = {
    bard: 2, cleric: 3, druid: 2, sorcerer: 4, warlock: 2, wizard: 3,
  };
  const b = base[(clazz ?? '').trim().toLowerCase()];
  if (b === undefined || level < 1) return 0;
  return b + (level >= 4 ? 1 : 0) + (level >= 10 ? 1 : 0);
}

// DEMO-ONLY mirror of the server prepared/known-spell tables (full-caster vs warlock pact).
const DEMO_FULL_PREPARED =
  [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const DEMO_PACT_PREPARED =
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];

export function demoPreparedSpells(clazz: string, level: number): number {
  const key = (clazz ?? '').trim().toLowerCase();
  if (level < 1) return 0;
  const idx = Math.min(level, 20) - 1;
  if (['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(key)) return DEMO_FULL_PREPARED[idx];
  if (key === 'warlock') return DEMO_PACT_PREPARED[idx];
  return 0;
}
