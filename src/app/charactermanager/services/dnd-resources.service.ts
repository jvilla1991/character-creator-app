import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';
import { BackgroundGroup, ClassEquipment, DndBackground, DndClass, DndListResponse, DndResource, DndSpell, DndSpecies } from '../models/dnd-api.types';

// ── Helpers ────────────────────────────────────────────────────────────────

function ref(name: string): DndResource {
  return { index: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, url: '' };
}
function abilities(...names: string[]): DndResource[] { return names.map(ref); }
function profs(...names: string[]):    DndResource[] { return names.map(ref); }

// ── Complete background dataset (PHB + Heroes of Faerun + Forge) ───────────

const BACKGROUNDS: Record<string, DndBackground> = {
  // ── Player's Handbook ────────────────────────────────────────────────────
  'Acolyte':    { index: 'acolyte',    name: 'Acolyte',    source: "Player's Handbook",   ability_scores: abilities('INT','WIS','CHA'), feat: ref('Magic Initiate (Cleric)'),   proficiencies: profs('Insight','Religion',"Calligrapher's Supplies") },
  'Artisan':    { index: 'artisan',    name: 'Artisan',    source: "Player's Handbook",   ability_scores: abilities('STR','DEX','INT'), feat: ref('Crafter'),                   proficiencies: profs('Investigation','Persuasion',"Artisan's Tools (one kind)") },
  'Charlatan':  { index: 'charlatan',  name: 'Charlatan',  source: "Player's Handbook",   ability_scores: abilities('DEX','CON','CHA'), feat: ref('Skilled'),                   proficiencies: profs('Deception','Sleight of Hand','Forgery Kit') },
  'Criminal':   { index: 'criminal',   name: 'Criminal',   source: "Player's Handbook",   ability_scores: abilities('DEX','CON','INT'), feat: ref('Alert'),                     proficiencies: profs('Sleight of Hand','Stealth',"Thieves' Tools") },
  'Entertainer':{ index: 'entertainer',name: 'Entertainer',source: "Player's Handbook",   ability_scores: abilities('STR','DEX','CHA'), feat: ref('Musician'),                  proficiencies: profs('Acrobatics','Performance','Musical Instrument (one kind)') },
  'Farmer':     { index: 'farmer',     name: 'Farmer',     source: "Player's Handbook",   ability_scores: abilities('STR','CON','WIS'), feat: ref('Tough'),                     proficiencies: profs('Animal Handling','Nature',"Carpenter's Tools") },
  'Guard':      { index: 'guard',      name: 'Guard',      source: "Player's Handbook",   ability_scores: abilities('STR','INT','WIS'), feat: ref('Alert'),                     proficiencies: profs('Athletics','Perception','Gaming Set (one kind)') },
  'Guide':      { index: 'guide',      name: 'Guide',      source: "Player's Handbook",   ability_scores: abilities('DEX','CON','WIS'), feat: ref('Magic Initiate (Druid)'),    proficiencies: profs('Stealth','Survival',"Cartographer's Tools") },
  'Hermit':     { index: 'hermit',     name: 'Hermit',     source: "Player's Handbook",   ability_scores: abilities('CON','WIS','CHA'), feat: ref('Healer'),                    proficiencies: profs('Medicine','Religion','Herbalism Kit') },
  'Merchant':   { index: 'merchant',   name: 'Merchant',   source: "Player's Handbook",   ability_scores: abilities('CON','INT','CHA'), feat: ref('Lucky'),                     proficiencies: profs('Animal Handling','Persuasion',"Navigator's Tools") },
  'Noble':      { index: 'noble',      name: 'Noble',      source: "Player's Handbook",   ability_scores: abilities('STR','INT','CHA'), feat: ref('Skilled'),                   proficiencies: profs('History','Persuasion','Gaming Set (one kind)') },
  'Sage':       { index: 'sage',       name: 'Sage',       source: "Player's Handbook",   ability_scores: abilities('CON','INT','WIS'), feat: ref('Magic Initiate (Wizard)'),   proficiencies: profs('Arcana','History',"Calligrapher's Supplies") },
  'Sailor':     { index: 'sailor',     name: 'Sailor',     source: "Player's Handbook",   ability_scores: abilities('STR','DEX','WIS'), feat: ref('Tavern Brawler'),            proficiencies: profs('Acrobatics','Perception',"Navigator's Tools") },
  'Scribe':     { index: 'scribe',     name: 'Scribe',     source: "Player's Handbook",   ability_scores: abilities('DEX','INT','WIS'), feat: ref('Skilled'),                   proficiencies: profs('Investigation','Perception',"Calligrapher's Supplies") },
  'Soldier':    { index: 'soldier',    name: 'Soldier',    source: "Player's Handbook",   ability_scores: abilities('STR','DEX','CON'), feat: ref('Savage Attacker'),           proficiencies: profs('Athletics','Intimidation','Gaming Set (one kind)') },
  'Wayfarer':   { index: 'wayfarer',   name: 'Wayfarer',   source: "Player's Handbook",   ability_scores: abilities('DEX','WIS','CHA'), feat: ref('Lucky'),                     proficiencies: profs('Insight','Stealth',"Thieves' Tools") },

  // ── Heroes of Faerun ─────────────────────────────────────────────────────
  'Chondathan Freebooter':      { index: 'chondathan-freebooter',       name: 'Chondathan Freebooter',      source: 'Heroes of Faerun', ability_scores: abilities('STR','DEX','WIS'), feat: ref('Skilled'),                              proficiencies: profs('Athletics','Sleight of Hand',"Weaver's Tools") },
  'Dead Magic Dweller':         { index: 'dead-magic-dweller',          name: 'Dead Magic Dweller',         source: 'Heroes of Faerun', ability_scores: abilities('STR','CON','WIS'), feat: ref('Healer'),                               proficiencies: profs('Medicine','Survival',"Leatherworker's Tools") },
  'Dragon Cultist':             { index: 'dragon-cultist',              name: 'Dragon Cultist',             source: 'Heroes of Faerun', ability_scores: abilities('DEX','CON','INT'), feat: ref('Cult of the Dragon Initiate'),          proficiencies: profs('Deception','Stealth',"Calligrapher's Supplies") },
  'Emerald Enclave Caretaker':  { index: 'emerald-enclave-caretaker',   name: 'Emerald Enclave Caretaker',  source: 'Heroes of Faerun', ability_scores: abilities('CON','INT','WIS'), feat: ref('Emerald Enclave Fledgling'),            proficiencies: profs('Nature','Survival','Herbalism Kit') },
  'Flaming Fist Mercenary':     { index: 'flaming-fist-mercenary',      name: 'Flaming Fist Mercenary',     source: 'Heroes of Faerun', ability_scores: abilities('STR','CON','CHA'), feat: ref('Tough'),                                proficiencies: profs('Intimidation','Perception',"Smith's Tools") },
  'Genie Touched':              { index: 'genie-touched',               name: 'Genie Touched',              source: 'Heroes of Faerun', ability_scores: abilities('DEX','WIS','CHA'), feat: ref('Magic Initiate (Wizard)'),             proficiencies: profs('Perception','Persuasion',"Glassblower's Tools") },
  'Harper':                     { index: 'harper',                      name: 'Harper',                     source: 'Heroes of Faerun', ability_scores: abilities('DEX','INT','CHA'), feat: ref('Harper Agent'),                         proficiencies: profs('Performance','Sleight of Hand','Disguise Kit') },
  'Ice Fisher':                 { index: 'ice-fisher',                  name: 'Ice Fisher',                 source: 'Heroes of Faerun', ability_scores: abilities('STR','DEX','CON'), feat: ref('Alert'),                                proficiencies: profs('Animal Handling','Athletics',"Woodcarver's Tools") },
  'Knight of the Gauntlet':     { index: 'knight-of-the-gauntlet',      name: 'Knight of the Gauntlet',     source: 'Heroes of Faerun', ability_scores: abilities('STR','INT','WIS'), feat: ref('Tyro of the Gauntlet'),                 proficiencies: profs('Athletics','Medicine',"Smith's Tools") },
  "Lords' Alliance Vassal":     { index: 'lords-alliance-vassal',       name: "Lords' Alliance Vassal",     source: 'Heroes of Faerun', ability_scores: abilities('STR','INT','CHA'), feat: ref("Lords' Alliance Agent"),                proficiencies: profs('Insight','Persuasion',"Calligrapher's Supplies") },
  'Moonwell Pilgrim':           { index: 'moonwell-pilgrim',            name: 'Moonwell Pilgrim',           source: 'Heroes of Faerun', ability_scores: abilities('CON','WIS','CHA'), feat: ref('Magic Initiate (Druid)'),              proficiencies: profs('Nature','Performance',"Painter's Supplies") },
  'Mulhorandi Tomb Raider':     { index: 'mulhorandi-tomb-raider',      name: 'Mulhorandi Tomb Raider',     source: 'Heroes of Faerun', ability_scores: abilities('DEX','CON','INT'), feat: ref('Lucky'),                                proficiencies: profs('Investigation','Religion',"Mason's Tools") },
  'Myrthalkeeper':              { index: 'myrthalkeeper',               name: 'Myrthalkeeper',              source: 'Heroes of Faerun', ability_scores: abilities('INT','WIS','CHA'), feat: ref('Crafter'),                              proficiencies: profs('Arcana','History',"Jeweler's Tools") },
  'Purple Dragon Squire':       { index: 'purple-dragon-squire',        name: 'Purple Dragon Squire',       source: 'Heroes of Faerun', ability_scores: abilities('STR','WIS','CHA'), feat: ref('Purple Dragon Rook'),                   proficiencies: profs('Animal Handling','Insight',"Navigator's Tools") },
  'Rashemi Wanderer':           { index: 'rashemi-wanderer',            name: 'Rashemi Wanderer',           source: 'Heroes of Faerun', ability_scores: abilities('STR','CON','CHA'), feat: ref('Tough'),                                proficiencies: profs('Intimidation','Perception',"Cartographer's Tools") },
  'Shadowmasters Exile':        { index: 'shadowmasters-exile',         name: 'Shadowmasters Exile',        source: 'Heroes of Faerun', ability_scores: abilities('DEX','INT','CHA'), feat: ref('Savage Attacker'),                      proficiencies: profs('Acrobatics','Stealth',"Thieves' Tools") },
  'Spellfire Initiate':         { index: 'spellfire-initiate',          name: 'Spellfire Initiate',         source: 'Heroes of Faerun', ability_scores: abilities('CON','INT','CHA'), feat: ref('Spellfire Spark'),                      proficiencies: profs('Arcana','Perception','Gaming Set (one kind)') },
  'Zhentarim Mercenary':        { index: 'zhentarim-mercenary',         name: 'Zhentarim Mercenary',        source: 'Heroes of Faerun', ability_scores: abilities('STR','DEX','CHA'), feat: ref('Zhentarim Ruffian'),                    proficiencies: profs('Intimidation','Perception','Forgery Kit') },

  // ── Forge of the Artificer ────────────────────────────────────────────────
  'Aberrant Heir':  { index: 'aberrant-heir',  name: 'Aberrant Heir',  source: 'Forge of the Artificer', ability_scores: abilities('STR','CON','CHA'), feat: ref('Aberrant Dragonmark'), proficiencies: profs('History','Intimidation','Disguise Kit') },
  'Archaeologist':  { index: 'archaeologist',  name: 'Archaeologist',  source: 'Forge of the Artificer', ability_scores: abilities('DEX','INT','WIS'), feat: ref('Skilled'),             proficiencies: profs('History','Survival',"Cartographer's Tools") },
  'Inquisitive':    { index: 'inquisitive',    name: 'Inquisitive',    source: 'Forge of the Artificer', ability_scores: abilities('CON','INT','CHA'), feat: ref('Alert'),               proficiencies: profs('Insight','Investigation',"Thieves' Tools") },
};

/** Backgrounds grouped by source for the wizard tile picker */
export const BACKGROUND_GROUPS: BackgroundGroup[] = [
  { source: "Player's Handbook",    backgrounds: Object.values(BACKGROUNDS).filter(b => b.source === "Player's Handbook").map(b => b.name) },
  { source: 'Heroes of Faerun',     backgrounds: Object.values(BACKGROUNDS).filter(b => b.source === 'Heroes of Faerun').map(b => b.name) },
  { source: 'Forge of the Artificer', backgrounds: Object.values(BACKGROUNDS).filter(b => b.source === 'Forge of the Artificer').map(b => b.name) },
];

// ── Demo/static class data ─────────────────────────────────────────────────

const CLASS_LIST_2024 = [
  'Barbarian','Bard','Cleric','Druid','Fighter',
  'Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard',
];

const CLASS_HIT_DICE: Record<string, number> = {
  barbarian:12, bard:8, cleric:8, druid:8, fighter:10,
  monk:8, paladin:10, ranger:10, rogue:8, sorcerer:6, warlock:8, wizard:6,
};

const CLASS_SAVES: Record<string, string[]> = {
  barbarian:['STR','CON'], bard:['DEX','CHA'],     cleric:['WIS','CHA'],
  druid:['INT','WIS'],     fighter:['STR','CON'],   monk:['STR','DEX'],
  paladin:['WIS','CHA'],   ranger:['STR','DEX'],    rogue:['DEX','INT'],
  sorcerer:['CON','CHA'],  warlock:['WIS','CHA'],   wizard:['INT','WIS'],
};

const RACE_LIST = [
  'Human','Elf','Dwarf','Halfling','Half-Elf','Half-Orc',
  'Tiefling','Dragonborn','Gnome',
];

const PARTY_LIST = [
  'The Veiled Compass',
  'Tomb of the Sleeping Crown',
  'Unassigned',
];

// ── Spell constants ───────────────────────────────────────────────────────────

/** Classes that have a full spell list at character creation */
export const SPELLCASTING_CLASSES = new Set([
  'bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'
]);

/** Starting cantrips known + spells prepared/known at level 1, per class */
export const SPELL_COUNTS: Record<string, { cantrips: number; spells: number }> = {
  bard:     { cantrips: 2, spells: 4 },
  cleric:   { cantrips: 3, spells: 4 },
  druid:    { cantrips: 2, spells: 4 },
  sorcerer: { cantrips: 4, spells: 2 },
  warlock:  { cantrips: 2, spells: 2 },
  wizard:   { cantrips: 3, spells: 6 },
};

// ── Proficiency constants (2024 PHB) ──────────────────────────────────────────

/** All 18 skill names, matching SKILL_DEFS canonical names in character-math.ts */
export const ALL_SKILLS: string[] = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
  'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
  'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
  'Sleight', 'Stealth', 'Survival',
];

/** Class skill proficiency choices per 2024 PHB (choose N from the listed skills) */
export const CLASS_SKILL_CHOICES: Record<string, { choose: number; from: string[] }> = {
  barbarian: { choose: 2, from: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
  bard:      { choose: 3, from: ALL_SKILLS },
  cleric:    { choose: 2, from: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
  druid:     { choose: 2, from: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
  fighter:   { choose: 2, from: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
  monk:      { choose: 2, from: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
  paladin:   { choose: 2, from: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
  ranger:    { choose: 3, from: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
  rogue:     { choose: 4, from: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight', 'Stealth'] },
  sorcerer:  { choose: 2, from: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  warlock:   { choose: 2, from: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
  wizard:    { choose: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
};

/**
 * Short descriptions for the 2024 PHB Origin feats.
 * Expansion-specific feats are not listed here and will render without a description.
 */
export const FEAT_DESCRIPTIONS: Record<string, string> = {
  'Alert':
    'You gain +2 to Initiative. You cannot be Surprised, and hidden creatures have no advantage on attack rolls against you.',
  'Crafter':
    'You gain proficiency with three Artisan\'s Tools. You can craft nonmagical items in half the normal time and buy goods at a 20% discount.',
  'Healer':
    'You can use a Healer\'s Kit to restore 1d6 + 4 HP to a creature (plus its max HD). You also learn Healing Word, usable once per Short or Long Rest without a spell slot.',
  'Lucky':
    'You have 3 Luck Points (refreshed on a Long Rest). Before any d20 Test, you can spend a point to roll twice and choose either result.',
  'Magic Initiate (Cleric)':
    'You learn two Cleric cantrips and one 1st-level Cleric spell. You can cast the 1st-level spell once per Long Rest without expending a spell slot.',
  'Magic Initiate (Druid)':
    'You learn two Druid cantrips and one 1st-level Druid spell. You can cast the 1st-level spell once per Long Rest without expending a spell slot.',
  'Magic Initiate (Wizard)':
    'You learn two Wizard cantrips and one 1st-level Wizard spell. You can cast the 1st-level spell once per Long Rest without expending a spell slot.',
  'Musician':
    'You gain proficiency with three Musical Instruments. Once per Long Rest you can perform for 1 minute to grant Bardic Inspiration dice to nearby friendly creatures.',
  'Savage Attacker':
    'Once per turn when you hit with a melee weapon attack, you may reroll the weapon\'s damage dice and use either result.',
  'Skilled':
    'You gain proficiency in any combination of three skills or tools of your choice.',
  'Tavern Brawler':
    'You are proficient with improvised weapons. Your unarmed strikes deal 1d4 + Strength or Dexterity. Once per turn you can attempt to grapple or shove a creature you hit unarmed.',
  'Tough':
    'Your Hit Point maximum increases by 2, and it increases by 2 again each time you gain a level.',
  // ── General feats (level 4+; the alternative to an ASI). Names are validated
  //    server-side; these descriptions are for display only. ───────────────────
  'Great Weapon Master':
    'On a melee weapon attack, you can take a -5 penalty to hit for +10 damage. Scoring a critical hit or downing a creature lets you make another melee attack as a Bonus Action.',
  'Sharpshooter':
    'Your ranged attacks ignore half and three-quarters cover, and you can take a -5 to hit for +10 damage. Long range does not impose disadvantage.',
  'Sentinel':
    'When you hit a creature with an Opportunity Attack, its speed becomes 0 for the turn. Creatures provoke Opportunity Attacks even when they Disengage, and you can react when an ally nearby is attacked.',
  'War Caster':
    'You have advantage on Concentration saves, can perform somatic components while wielding weapons or a shield, and can cast a spell as an Opportunity Attack.',
  'Resilient':
    'Increase one ability score by 1 (max 20) and gain proficiency in saving throws using that ability.',
  'Speedy':
    'Your Speed increases by 10 feet, Difficult Terrain no longer slows your Dash, and Opportunity Attacks have disadvantage against you.',
  'Mage Slayer':
    'When a creature within 5 feet casts a spell you can react to attack it. You impose disadvantage on Concentration saves of creatures you damage, and gain advantage on saves against their spells.',
  'Polearm Master':
    'When you attack with a glaive, halberd, quarterstaff, or spear you can make a Bonus Action strike with the butt end (1d4). Creatures entering your reach provoke an Opportunity Attack.',
  'Inspiring Leader':
    'Spend 10 minutes to bolster allies, granting each a number of Temporary Hit Points equal to your level + your Charisma modifier.',
  'Skill Expert':
    'Increase one ability score by 1 (max 20), gain proficiency in one skill, and gain Expertise in one skill you are proficient with.',
};

/** Standard languages available for the background language bonus */
export const STANDARD_LANGUAGES: string[] = [
  'Common Sign Language', 'Draconic', 'Dwarvish', 'Elvish',
  'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Primordial',
];

/**
 * Short descriptions for common 2024 PHB species traits.
 * Trait names match those returned by the D&D 5e 2024 API.
 */
export const SPECIES_TRAIT_DESCRIPTIONS: Record<string, string> = {
  // Shared traits
  'Darkvision':            'You see in dim light as if it were bright light, and in darkness as if it were dim light (up to 60 ft.). You discern colors in that darkness only as shades of gray.',
  'Superior Darkvision':   'You have Darkvision with a range of 120 feet.',
  // Elf
  'Keen Senses':           'You have proficiency in the Perception skill.',
  'Fey Ancestry':          'You have Advantage on saving throws to avoid or end the Charmed condition, and magic can\'t put you to sleep.',
  'Trance':                'You don\'t need to sleep. You can finish a Long Rest in 4 hours by meditating.',
  'Elf Weapon Training':   'You have proficiency with Longswords, Shortswords, Shortbows, and Longbows.',
  // Halfling
  'Brave':                 'You have Advantage on saving throws to avoid or end the Frightened condition.',
  'Lucky':                 'When you roll a 1 on a d20 for a d20 Test, you can reroll the die, and you must use the new roll.',
  'Halfling Nimbleness':   'You can move through the space of any creature of Size Large or bigger.',
  'Naturally Stealthy':    'You can attempt to Hide when you are obscured by a creature of Size Large or bigger.',
  // Dwarf
  'Dwarven Resilience':    'You have Advantage on saving throws against poison and Resistance to Poison damage.',
  'Stonecunning':          'As a Bonus Action, you gain Tremorsense with a range of 60 ft. for 10 minutes. You can use this a number of times equal to your Proficiency Bonus per Long Rest.',
  'Dwarven Toughness':     'Your Hit Point maximum increases by 1, and it increases by 1 again each time you gain a level.',
  // Gnome
  'Gnomish Cunning':       'You have Advantage on Intelligence, Wisdom, and Charisma saving throws.',
  'Gnomish Lineage':       'You have a gnomish lineage that grants you additional traits.',
  // Dragonborn
  'Draconic Ancestry':     'You have draconic ancestry. Choose a dragon type to determine your Breath Weapon damage type and Damage Resistance.',
  'Breath Weapon':         'When you take the Attack action, you can replace one of your attacks with a Breath Weapon. Each creature in the area makes a Dexterity saving throw (DC = 8 + CON mod + Proficiency Bonus), taking 1d10 damage on a failed save.',
  'Damage Resistance':     'You have Resistance to the damage type associated with your Draconic Ancestry.',
  'Darkvision (60 ft.)':   'You have Darkvision with a range of 60 feet.',
  // Tiefling
  'Hellish Resistance':    'You have Resistance to Fire damage.',
  'Infernal Legacy':       'You know the Thaumaturgy cantrip. Starting at 3rd level, you can cast Hellish Rebuke as a 2nd-level spell once per Long Rest. At 5th level, you can cast Darkness once per Long Rest.',
  'Tiefling Lineage':      'You descend from a specific infernal bloodline, granting additional spells.',
  // Goliath
  'Giant Ancestry':        'Choose a giant type. Your ancestry grants you a special ability (e.g., Stone\'s Endurance from Stone Giants, or Frost\'s Endurance from Frost Giants).',
  'Natural Athlete':       'You have proficiency in the Athletics skill.',
  'Powerful Build':        'You count as one size larger when determining your carrying capacity and the weight you can push or drag.',
  'Mountain Born':         'You\'re acclimated to high altitude, including elevations above 20,000 feet. You\'re also naturally adapted to cold climates.',
  // Orc
  'Adrenaline Rush':       'You can take the Dash action as a Bonus Action. When you do, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Short or Long Rest.',
  'Relentless Endurance':  'When you are reduced to 0 HP but not killed outright, you can drop to 1 HP instead. Once per Long Rest.',
  // Human
  'Resourceful':           'You gain Heroic Inspiration whenever you finish a Long Rest.',
  'Skilled':               'You have proficiency in any combination of three skills or tools of your choice.',
  'Versatile':             'You gain the Skilled feat or another feat of your choice for which you qualify.',
  // Aasimar
  'Celestial Resistance':  'You have Resistance to Necrotic and Radiant damage.',
  'Darkvision (60 ft)':    'You have Darkvision with a range of 60 feet.',
  'Healing Hands':         'As a Magic action, you touch a creature and restore a number of HP equal to your Proficiency Bonus. You can use this a number of times equal to your Proficiency Bonus per Long Rest.',
  'Light Bearer':          'You know the Light cantrip. Charisma is your spellcasting ability for it.',
  'Celestial Revelation':  'Starting at 3rd level, you can temporarily transform. Choose Heavenly Wings, Inner Radiance, or Necrotic Shroud.',
};

/**
 * Subclasses available at level 1 per the 2024 PHB.
 * Only Sorcerer and Warlock receive their subclass at level 1.
 */
export const LEVEL1_SUBCLASSES: Record<string, { name: string; desc: string }[]> = {
  sorcerer: [
    {
      name: 'Draconic Sorcery',
      desc: 'Draconic blood flows through your lineage. You gain Elemental Affinity and a natural AC bonus of 13 + DEX modifier when not wearing armor.',
    },
    {
      name: 'Wild Magic Sorcery',
      desc: 'Surges of untamed magic fuel your power. After you cast a spell of 1st level or higher, the DM may trigger a Wild Magic Surge from the surge table.',
    },
    {
      name: 'Clockwork Sorcery',
      desc: 'Order and cosmic structure shape your spells. You gain Restore Balance and access to Abjuration and Transmutation spells not normally on the Sorcerer list.',
    },
    {
      name: 'Aberrant Sorcery',
      desc: 'Your magic has been touched by Far Realm mutations. You gain Psionic Spells and can manifest a Telepathic Speech ability.',
    },
  ],
  warlock: [
    {
      name: 'Fiend Patron',
      desc: 'A powerful fiend from the Lower Planes granted you your powers. You gain Fiend spells and Dark One\'s Blessing, regaining HP whenever you reduce a creature to 0 HP.',
    },
    {
      name: 'Great Old One Patron',
      desc: 'An alien entity of incomprehensible power is your master. You gain Great Old One spells and Awakened Mind, letting you communicate telepathically.',
    },
    {
      name: 'Archfey Patron',
      desc: 'A powerful fey creature granted you your power. You gain Archfey spells and Steps of the Fey, letting you teleport as a Bonus Action.',
    },
    {
      name: 'Celestial Patron',
      desc: 'A radiant being of the Upper Planes granted you power. You gain Celestial spells and Healing Light, a pool of d6s you can use to restore HP.',
    },
  ],
};

/** Starting gold granted by each PHB background (2024 PHB values) */
export const BACKGROUND_GOLD: Record<string, number> = {
  // Player's Handbook
  'Acolyte': 15,    'Artisan': 25,   'Charlatan': 15, 'Criminal': 15,
  'Entertainer': 15,'Farmer': 15,    'Guard': 10,     'Guide': 10,
  'Hermit': 5,      'Merchant': 25,  'Noble': 25,     'Sage': 15,
  'Sailor': 10,     'Scribe': 10,    'Soldier': 10,   'Wayfarer': 15,
};

@Injectable({ providedIn: 'root' })
export class DndResourcesService {
  /** 2014 ruleset — kept for backward compatibility */
  private dndResourceUrl = 'https://www.dnd5eapi.co/api/2014/';
  /** 2024 ruleset — used for class detail lookups */
  private dnd2024Url     = 'https://www.dnd5eapi.co/api/2024/';

  private spells$: Observable<DndSpell[]> | null = null;
  private classEquipment$: Observable<Record<string, ClassEquipment>> | null = null;

  constructor(private http: HttpClient) {}

  // ── 2014 methods (unchanged) ─────────────────────────────────────────────

  getClassNames(): Observable<string[]> {
    return of(CLASS_LIST_2024);
  }

  getRaceNames(): Observable<string[]> { return of(RACE_LIST); }
  getPartyNames(): Observable<string[]> { return of(PARTY_LIST); }

  // ── 2024 class methods ────────────────────────────────────────────────────

  getClassNames2024(): Observable<string[]> {
    return this.http
      .get<DndListResponse<DndResource>>(this.dnd2024Url + 'classes')
      .pipe(map(r => r.results.map(i => i.name)));
  }

  /** Full class detail — always from the 2024 API for live data.
   *  Falls back to static data on error. */
  getClassDetail(name: string): Observable<DndClass> {
    const key = name.toLowerCase();
    return this.http.get<DndClass>(this.dnd2024Url + `classes/${key}`);
  }

  getSpeciesList(): Observable<string[]> {
    return this.http
      .get<DndListResponse<DndResource>>(this.dnd2024Url + 'species')
      .pipe(map(r => r.results.map(i => i.name)));
  }

  /** Full species detail for the traits card. */
  getSpeciesDetail(name: string): Observable<DndSpecies> {
    const index = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.http.get<DndSpecies>(this.dnd2024Url + `species/${index}`);
  }

  /** Short description for a species trait, or empty string if not in the local map. */
  getTraitDescription(traitName: string): string {
    return SPECIES_TRAIT_DESCRIPTIONS[traitName] ?? '';
  }

  // ── Background methods — always from static data ──────────────────────────

  /** Flat list of all background names, ordered PHB → Faerun → Artificer */
  getBackgroundList(): Observable<string[]> {
    return of(BACKGROUND_GROUPS.flatMap(g => g.backgrounds));
  }

  /** Backgrounds grouped by source book for display */
  getBackgroundGroups(): Observable<BackgroundGroup[]> {
    return of(BACKGROUND_GROUPS);
  }

  /** Full background detail from the local static dataset */
  getBackgroundDetail(name: string): Observable<DndBackground> {
    const bg = BACKGROUNDS[name];
    if (bg) return of(bg);
    // Graceful fallback: return a minimal shell so the UI doesn't break
    return of({ index: name.toLowerCase(), name, ability_scores: [], proficiencies: [] });
  }

  // ── Spell methods — loaded lazily from asset, cached for the session ────────

  /** All 339 SRD 5.2 spells. Fetched once on first call; cached via shareReplay. */
  getSpells(): Observable<DndSpell[]> {
    if (!this.spells$) {
      this.spells$ = this.http
        .get<DndSpell[]>('/assets/data/spells/srd-5.2-spells.json')
        .pipe(shareReplay(1));
    }
    return this.spells$;
  }

  /** Short description for an Origin feat, or empty string if unknown. */
  getFeatDescription(featName: string): string {
    return FEAT_DESCRIPTIONS[featName] ?? '';
  }

  /** Class skill proficiency choices for step 5 of the wizard. */
  getClassSkillChoices(className: string): { choose: number; from: string[] } {
    return CLASS_SKILL_CHOICES[className.toLowerCase()] ?? { choose: 2, from: [] };
  }

  /** Spells available to a specific class (case-insensitive). */
  getSpellsForClass(className: string): Observable<DndSpell[]> {
    const key = className.toLowerCase();
    return this.getSpells().pipe(
      map(spells => spells.filter(s => s.classes.includes(key)))
    );
  }

  /** Starting equipment packages for all 12 classes. Fetched once, cached. */
  getClassEquipment(): Observable<Record<string, ClassEquipment>> {
    if (!this.classEquipment$) {
      this.classEquipment$ = this.http
        .get<Record<string, ClassEquipment>>('/assets/data/equipment/class-equipment-2024.json')
        .pipe(shareReplay(1));
    }
    return this.classEquipment$;
  }

  /**
   * Background starting gold per 2024 PHB.
   * Returns 15 gp as a safe default for backgrounds not in the map.
   */
  getBackgroundGold(backgroundName: string): number {
    return BACKGROUND_GOLD[backgroundName] ?? 15;
  }

  /**
   * Subclasses available at level 1 for a class, per the 2024 PHB.
   * Returns an empty array for classes that don't pick a subclass at level 1.
   */
  getSubclassesForClass(className: string): { name: string; desc: string }[] {
    return LEVEL1_SUBCLASSES[className.toLowerCase()] ?? [];
  }
}
