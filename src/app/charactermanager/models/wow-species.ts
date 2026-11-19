import type { CatalogSpecies, SpeciesLineage, SpeciesTrait } from './species';

/**
 * The World of Warcraft module's species (chapter 2, Character Origins), in
 * book order. A WoW character pairs one of these with a Player's Handbook
 * background.
 *
 * Trait text is paraphrased and written for the trait card. The structured
 * fields beside it (resistances, darkvision, skills, cantrips, spells, choices)
 * say the same thing in a form the wizard can read.
 */

const SOURCE = 'World of Warcraft' as const;
const key = (name: string): string => `${name} (${SOURCE})`;

const CASTING_ABILITIES = ['INT', 'WIS', 'CHA'] as const;

const darkvision = (feet: number): SpeciesTrait => ({
  name: 'Darkvision',
  desc: `You have Darkvision with a range of ${feet} feet.`,
});

/** How the level 3 and level 5 spells of a lineage work — the same for every species that has them. */
const LINEAGE_SPELL_RULE =
  'At character levels 3 and 5 you learn the lineage\'s next spell. It is always prepared, you can cast it once per '
  + 'Long Rest without a spell slot, and you can also cast it with your spell slots. Intelligence, Wisdom or Charisma '
  + 'is your spellcasting ability for these spells; you choose which when you pick the lineage.';

/** The same rule, worded for the card of a lineage that has already been chosen. */
const CHOSEN_LINEAGE_SPELL_RULE =
  'Each lineage spell is always prepared from the level you learn it. You can cast it once per Long Rest without a '
  + 'spell slot, and you can also cast it with your spell slots.';

const FEY_ANCESTRY: SpeciesTrait = {
  name: 'Fey Ancestry',
  desc: 'You have Advantage on saving throws to avoid or end the Charmed condition.',
};

/** A lineage that gives a resistance, a cantrip, then a spell at levels 3 and 5. */
function spellLineage(
  name: string, level1: string, level3: string, level5: string, extra: Partial<SpeciesLineage> = {},
): SpeciesLineage {
  return {
    name,
    desc: `${level1} Level 3: ${level3}. Level 5: ${level5}.`,
    spells: [{ level: 3, name: level3 }, { level: 5, name: level5 }],
    ...extra,
  };
}

export const WOW_SPECIES: readonly CatalogSpecies[] = [
  // ── Dracthyr ───────────────────────────────────────────────────────────────
  {
    key: key('Dracthyr'), name: 'Dracthyr', source: SOURCE,
    creatureType: 'Dragon', sizes: ['Medium'], height: 'about 7 feet tall', speed: 30, darkvision: 60,
    traits: [
      darkvision(60),
      { name: 'Gliding Wings',
        desc: 'In your natural form, unless you are Incapacitated, you treat a fall as up to 100 feet shorter when '
          + 'working out its damage, and you can move 2 feet sideways for every 1 foot you descend.' },
      { name: 'Natural Weaponry',
        desc: 'In your natural form you can use a Bonus Action to make an Unarmed Strike with your wings or tail to '
          + 'Shove a creature.' },
      { name: 'Visage',
        desc: 'As a Magic action you shift between your natural form and your visage, a humanoid form whose look you '
          + 'decide when you choose this species. Your clothing, equipment and game statistics stay the same.' },
      { name: 'Draconic Flight',
        desc: 'From character level 5: as a Bonus Action in your natural form, you gain a Fly Speed equal to your '
          + 'Speed for 10 minutes. Once you use this trait you can\'t use it again until you finish a Long Rest.' },
    ],
  },

  // ── Draenei ────────────────────────────────────────────────────────────────
  {
    key: key('Draenei'), name: 'Draenei', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'over 7 feet tall', speed: 30, darkvision: 60,
    traits: [
      darkvision(60),
      { name: 'Eredar Lineage',
        desc: `Choose a lineage. It gives you a damage Resistance and a cantrip at level 1. ${LINEAGE_SPELL_RULE}` },
      { name: 'Heroic Presence',
        desc: 'When you cast a spell from your Eredar Lineage and you don\'t have Heroic Inspiration, you gain it. '
          + 'You can do this once, and again after you finish a Short or Long Rest.' },
    ],
    lineageTrait: 'Eredar Lineage',
    lineages: [
      spellLineage('Draenei', 'Resistance to Necrotic damage and the Spare the Dying cantrip.',
        'Healing Word', 'Prayer of Healing', { resistances: ['Necrotic'], cantrips: ['Spare the Dying'] }),
      spellLineage('Krokul', 'Resistance to Poison damage and the Poison Spray cantrip.',
        'Ray of Sickness', 'Hold Person', { resistances: ['Poison'], cantrips: ['Poison Spray'] }),
      spellLineage('Lightforged', 'Resistance to Radiant damage and the Sacred Flame cantrip.',
        'Guiding Bolt', 'Aid', { resistances: ['Radiant'], cantrips: ['Sacred Flame'] }),
      spellLineage('Man\'ari', 'Resistance to Fire damage and the Fire Bolt cantrip.',
        'Hellish Rebuke', 'Darkness', { resistances: ['Fire'], cantrips: ['Fire Bolt'] }),
    ],
    lineageRule: CHOSEN_LINEAGE_SPELL_RULE,
    choices: { ability: { use: 'spellcasting', from: CASTING_ABILITIES, trait: 'Eredar Lineage' } },
  },

  // ── Dwarf ──────────────────────────────────────────────────────────────────
  {
    key: key('Dwarf'), name: 'Dwarf', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 4 to 5 feet tall', speed: 30, darkvision: 120,
    resistances: ['Poison'],
    traits: [
      darkvision(120),
      { name: 'Dwarven Resilience',
        desc: 'You have Resistance to Poison damage, and Advantage on saving throws to avoid or end the Poisoned '
          + 'condition.' },
      { name: 'Dwarven Toughness',
        desc: 'Your Hit Point maximum goes up by 1, and by 1 more every time you gain a level.' },
      { name: 'Stonecunning',
        desc: 'As a Bonus Action, while you stand on or touch stone (natural or worked), you gain Tremorsense with a '
          + 'range of 60 feet for 10 minutes. You can do this a number of times equal to your Proficiency Bonus, and '
          + 'you regain all uses when you finish a Long Rest.' },
    ],
  },

  // ── Earthen ────────────────────────────────────────────────────────────────
  {
    key: key('Earthen'), name: 'Earthen', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 4 to 5 feet tall', speed: 30, darkvision: 120,
    resistances: ['Poison'],
    traits: [
      { name: 'Azerite Surge',
        desc: 'When you take the Attack action on your turn, you can swap one attack for a 15-foot Cone of Azerite '
          + 'energy. Each creature you choose in the Cone regains 1d10 Hit Points. Every other creature in it makes a '
          + 'Dexterity saving throw (DC 8 + your Constitution modifier + your Proficiency Bonus), taking 1d10 Radiant '
          + 'damage on a failure or half as much on a success. The healing and the damage both become 2d10 at '
          + 'character level 5, 3d10 at level 11 and 4d10 at level 17. You can use this a number of times equal to '
          + 'your Proficiency Bonus, and you regain all uses when you finish a Long Rest.' },
      darkvision(120),
      { name: 'Earthen Resilience',
        desc: 'You have Resistance to Poison damage, and Advantage on saving throws to avoid or end the Poisoned '
          + 'condition.' },
      { name: 'Ingest Minerals', desc: 'You don\'t gain Exhaustion levels from malnutrition.' },
      { name: 'Quiet Contemplation',
        desc: 'When you spend Hit Point Dice at the end of a Short Rest, you regain 1 extra Hit Point for each die '
          + 'you spend.' },
    ],
  },

  // ── Elf ────────────────────────────────────────────────────────────────────
  {
    key: key('Elf'), name: 'Elf', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 6 to 8 feet tall', speed: 30, darkvision: 60,
    traits: [
      darkvision(60),
      { name: 'Azeroth Elven Lineage',
        desc: `Choose a lineage. It gives you a benefit at level 1. ${LINEAGE_SPELL_RULE}` },
      FEY_ANCESTRY,
      { name: 'Keen Senses', desc: 'You have proficiency in the Insight, Perception or Survival skill (your choice).' },
      { name: 'Trance',
        desc: 'You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if '
          + 'you spend them in a trancelike meditation, during which you stay conscious.' },
    ],
    lineageTrait: 'Azeroth Elven Lineage',
    lineageRule: CHOSEN_LINEAGE_SPELL_RULE,
    lineages: [
      spellLineage('Blood Elf',
        'You know the Prestidigitation cantrip, and after any Long Rest you can swap it for another Wizard cantrip.',
        'Detect Magic', 'Arcane Vigor', { cantrips: ['Prestidigitation'] }),
      spellLineage('Night Elf',
        'You have proficiency in the Stealth skill, and in Dim Light or Darkness you can take the Hide action as a '
        + 'Bonus Action.',
        'Longstrider', 'Pass without Trace', { skills: ['Stealth'] }),
      spellLineage('Nightborne',
        'Your Darkvision reaches 120 feet, and you know the Arcane Pulse cantrip.',
        'Faerie Fire', 'Darkness', { darkvision: 120, cantrips: ['Arcane Pulse'] }),
      spellLineage('Void Elf',
        'Your Darkvision reaches 120 feet, and you know the Mind Sliver cantrip.',
        'Entropic Embrace', 'Misty Step', { darkvision: 120, cantrips: ['Mind Sliver'] }),
      spellLineage('High Elf',
        'You know the Prestidigitation cantrip, and after any Long Rest you can swap it for another Wizard cantrip.',
        'Detect Magic', 'Misty Step', { cantrips: ['Prestidigitation'] }),
    ],
    choices: {
      skill: { count: 1, from: ['Insight', 'Perception', 'Survival'] },
      ability: { use: 'spellcasting', from: CASTING_ABILITIES, trait: 'Azeroth Elven Lineage' },
    },
  },

  // ── Forsaken ───────────────────────────────────────────────────────────────
  {
    key: key('Forsaken'), name: 'Forsaken', source: SOURCE,
    creatureType: 'Undead', sizes: ['Small', 'Medium'],
    height: 'about 4 to 7 feet tall if Medium, about 2 to 4 feet tall if Small', speed: 30, darkvision: 60,
    resistances: ['Necrotic'],
    traits: [
      darkvision(60),
      { name: 'Deathly Endurance', desc: 'You have Resistance to Necrotic damage.' },
      { name: 'Everlasting',
        desc: 'You don\'t gain Exhaustion levels from dehydration, malnutrition or suffocation. You don\'t need to '
          + 'sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend them '
          + 'inactive and motionless, during which you stay conscious.' },
      { name: 'Touch of the Grave',
        desc: 'When you deal damage to a creature, you can roll a number of d4s equal to your Proficiency Bonus. The '
          + 'creature takes that much extra Necrotic damage and you regain the same number of Hit Points. Once you '
          + 'use this trait you can\'t use it again until you finish a Long Rest.' },
      { name: 'Will of the Forsaken',
        desc: 'You have Advantage on saving throws to avoid or end the Charmed or Frightened condition.' },
    ],
  },

  // ── Gnome ──────────────────────────────────────────────────────────────────
  {
    key: key('Gnome'), name: 'Gnome', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Small'], height: 'about 3 to 4 feet tall', speed: 30, darkvision: 60,
    cantrips: ['Mending', 'Prestidigitation'],
    traits: [
      darkvision(60),
      { name: 'Gnomish Cunning',
        desc: 'You have Advantage on Intelligence, Wisdom and Charisma saving throws.' },
      { name: 'Gnomish Lineage',
        desc: 'You know the Mending and Prestidigitation cantrips. Intelligence, Wisdom or Charisma is your '
          + 'spellcasting ability for them (your choice). You can also spend 10 minutes casting Prestidigitation to '
          + 'build a Tiny clockwork device (AC 5, 1 Hit Point) that holds one Prestidigitation effect of your choice; '
          + 'anyone can set it off with a touch as a Bonus Action. You can have three devices at a time. Each falls '
          + 'apart after 8 hours, or when you dismantle it with a touch as a Utilize action.' },
    ],
    choices: { ability: { use: 'spellcasting', from: CASTING_ABILITIES, trait: 'Gnomish Lineage' } },
  },

  // ── Mechagnome ─────────────────────────────────────────────────────────────
  {
    key: key('Mechagnome'), name: 'Mechagnome', source: SOURCE,
    creatureType: 'Construct', sizes: ['Small'], height: 'about 4 feet tall', speed: 30,
    resistances: ['Poison'],
    traits: [
      { name: 'Built for Success',
        desc: 'You can add 1d4 to one D20 Test you make, after you roll but before the outcome is resolved. You can '
          + 'do this a number of times equal to your Proficiency Bonus, and you regain all uses when you finish a '
          + 'Long Rest.' },
      { name: 'Emergency Fail-Safe',
        desc: 'When you become Bloodied, you can take a Reaction to spend one Hit Point Die and regain Hit Points '
          + 'equal to the roll plus your Constitution modifier (at least 1). Once you use this trait you can\'t use '
          + 'it again until you finish a Short or Long Rest.' },
      { name: 'Mechanical Nature',
        desc: 'You have Resistance to Poison damage, and Advantage on saving throws to avoid or end the Paralyzed or '
          + 'Poisoned condition. You don\'t gain Exhaustion levels from dehydration, malnutrition or suffocation.' },
      { name: 'Sentry\'s Rest',
        desc: 'You don\'t need to sleep. You can finish a Long Rest in 6 hours if you spend them inactive and '
          + 'motionless, during which you stay conscious.' },
      { name: 'Specialized Design', desc: 'You gain proficiency with two tools of your choice.' },
    ],
    choices: { tools: 2 },
  },

  // ── Goblin ─────────────────────────────────────────────────────────────────
  {
    key: key('Goblin'), name: 'Goblin', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Small'], height: 'about 4 feet tall', speed: 30, darkvision: 60,
    traits: [
      darkvision(60),
      FEY_ANCESTRY,
      { name: 'Fury of the Small',
        desc: 'When you damage a creature larger than you with an attack or a spell, you can deal extra damage equal '
          + 'to your Proficiency Bonus, of the same type. You can do this a number of times equal to your '
          + 'Proficiency Bonus, no more than once per turn, and you regain all uses when you finish a Long Rest.' },
      { name: 'Nimble Escape',
        desc: 'You can take the Disengage or Hide action as a Bonus Action on each of your turns.' },
    ],
  },

  // ── Haranir ────────────────────────────────────────────────────────────────
  {
    key: key('Haranir'), name: 'Haranir', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 7 to 8 feet tall', speed: 30, darkvision: 120,
    skills: ['Nature', 'Survival'],
    cantrips: ['Druidcraft', 'Thorn Whip'],
    spells: [{ level: 3, name: 'Entangle' }, { level: 5, name: 'Spike Growth' }],
    traits: [
      darkvision(120),
      { name: 'Gift of the World Tree', desc: 'You have proficiency in the Nature and Survival skills.' },
      { name: 'Haranir Magic',
        desc: 'You know the Druidcraft and Thorn Whip cantrips. At character level 3 you learn Entangle, and at '
          + 'level 5 Spike Growth. Each is always prepared, you can cast it once per Long Rest without a spell slot, '
          + 'and you can also cast it with your spell slots. Intelligence, Wisdom or Charisma is your spellcasting '
          + 'ability for these spells; you choose which when you pick this species.' },
    ],
    choices: { ability: { use: 'spellcasting', from: CASTING_ABILITIES, trait: 'Haranir Magic' } },
  },

  // ── Human ──────────────────────────────────────────────────────────────────
  {
    key: key('Human'), name: 'Human', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Small', 'Medium'],
    height: 'about 4 to 7 feet tall if Medium, about 2 to 4 feet tall if Small', speed: 30,
    traits: [
      { name: 'Resourceful', desc: 'You gain Heroic Inspiration whenever you finish a Long Rest.' },
      { name: 'Skillful', desc: 'You gain proficiency in one skill of your choice.' },
      { name: 'Versatile',
        desc: 'You gain an Origin feat of your choice. Humans of Azeroth can also choose Arathi Heritage, Child of '
          + 'the Sea or Will to Survive.' },
    ],
    choices: { skill: { count: 1, from: 'any' }, originFeat: true },
  },

  // ── Orc ────────────────────────────────────────────────────────────────────
  {
    key: key('Orc'), name: 'Orc', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 6 to 7 feet tall', speed: 30, darkvision: 120,
    traits: [
      { name: 'Adrenaline Rush',
        desc: 'You can take the Dash action as a Bonus Action. When you do, you gain Temporary Hit Points equal to '
          + 'your Proficiency Bonus. You can do this a number of times equal to your Proficiency Bonus, and you '
          + 'regain all uses when you finish a Short or Long Rest.' },
      darkvision(120),
      { name: 'Relentless Endurance',
        desc: 'When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. '
          + 'Once you use this trait you can\'t use it again until you finish a Long Rest.' },
    ],
  },

  // ── Pandaren ───────────────────────────────────────────────────────────────
  {
    key: key('Pandaren'), name: 'Pandaren', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 6 to 7 feet tall', speed: 30, darkvision: 60,
    traits: [
      { name: 'Bouncy', desc: 'You have Resistance to Bludgeoning damage from falling.' },
      darkvision(60),
      { name: 'Inner Peace',
        desc: 'When you spend Hit Point Dice to regain Hit Points after a Short Rest, you regain 1 extra Hit Point '
          + 'for each die you spend.' },
      { name: 'Quaking Palm',
        desc: 'When you hit a creature with a melee attack on your turn, your movement doesn\'t provoke Opportunity '
          + 'Attacks from that creature until the end of the turn.' },
    ],
  },

  // ── Tauren ─────────────────────────────────────────────────────────────────
  {
    key: key('Tauren'), name: 'Tauren', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 8 to 9 feet tall', speed: 30,
    traits: [
      { name: 'Horns',
        desc: 'When you hit with an Unarmed Strike and deal damage, you can deal Piercing damage equal to 1d6 plus '
          + 'your Strength modifier instead of the strike\'s normal damage.' },
      { name: 'Goring Rush',
        desc: 'Right after you take the Dash action on your turn and move at least 20 feet, you can make one Unarmed '
          + 'Strike as a Bonus Action.' },
      { name: 'Hammering Horns',
        desc: 'Right after you hit a creature with a melee attack as part of the Attack action on your turn, you can '
          + 'use a Bonus Action to shove it with an Unarmed Strike if it is within 5 feet of you. This shove can push '
          + 'the target up to 10 feet instead of 5.' },
      { name: 'Tauren Lineage',
        desc: 'Choose a lineage. Where a lineage calls for a saving throw, the DC is 8 + your Proficiency Bonus + '
          + 'your Strength, Constitution or Wisdom modifier; you choose which when you pick the lineage.' },
    ],
    lineageTrait: 'Tauren Lineage',
    lineages: [
      { name: 'Mulgore Tauren',
        desc: 'When you take the Attack action on your turn, you can swap one attack for a war stomp, unless you are '
          + 'Prone, flying, climbing or swimming. Each creature you choose in a 5-foot Emanation from you makes a '
          + 'Constitution saving throw or has the Stunned condition until the end of your current turn.' },
      { name: 'Highmountain Tauren',
        desc: 'As an action, you move up to your Speed without provoking Opportunity Attacks and can pass through '
          + 'other creatures\' spaces. Each Medium or smaller creature whose space you enter makes a Strength saving '
          + 'throw or takes damage equal to your Proficiency Bonus plus your Strength modifier and has the Prone '
          + 'condition. A creature can take this damage only once per turn.' },
      { name: 'Taunka',
        desc: 'You gain a +1 bonus to Armor Class and Resistance to Cold damage.',
        acBonus: 1, resistances: ['Cold'], noAbilityChoice: true },
    ],
    choices: { ability: { use: 'save DC', from: ['STR', 'CON', 'WIS'], trait: 'Tauren Lineage' } },
  },

  // ── Troll ──────────────────────────────────────────────────────────────────
  {
    key: key('Troll'), name: 'Troll', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: 'about 7 feet tall', speed: 30, darkvision: 60,
    traits: [
      { name: 'Bloodied Frenzy', desc: 'While you are Bloodied, you have Advantage on attack rolls.' },
      darkvision(60),
      { name: 'Troll Healing',
        desc: 'When you spend Hit Point Dice to regain Hit Points after a Short Rest, each die heals its highest '
          + 'possible roll plus your Constitution modifier.' },
      { name: 'Troll Lineage', desc: 'Choose a lineage.' },
    ],
    lineageTrait: 'Troll Lineage',
    lineages: [
      { name: 'Amani Troll',
        desc: 'Whenever you spend Heroic Inspiration, you regain 1 spent Hit Point Die.' },
      { name: 'Darkspear Troll',
        desc: 'When you take the Dash action, Difficult Terrain made of ice, rubble, snow or undergrowth costs you no '
          + 'extra movement until the end of your turn.' },
      { name: 'Zandalari Troll',
        desc: 'If you roll a 1 on the d20 for a D20 Test, you gain Heroic Inspiration at the end of the current '
          + 'turn.' },
    ],
  },

  // ── Vulpera ────────────────────────────────────────────────────────────────
  {
    key: key('Vulpera'), name: 'Vulpera', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Small'], height: 'about 4 to 5 feet tall', speed: 30, darkvision: 60,
    resistances: ['Fire'],
    traits: [
      darkvision(60),
      { name: 'Fire Resistance', desc: 'You have Resistance to Fire damage.' },
      { name: 'Nose for Trouble',
        desc: 'The first time you take damage after you roll Initiative, you reduce that damage by your level, to a '
          + 'minimum of 0.' },
      { name: 'Vulpera Nimbleness',
        desc: 'You can move through the space of any creature larger than you, but you can\'t stop there.' },
    ],
  },

  // ── Worgen ─────────────────────────────────────────────────────────────────
  {
    key: key('Worgen'), name: 'Worgen', source: SOURCE,
    creatureType: 'Humanoid', sizes: ['Medium'], height: '4 to 7 feet tall', speed: 30, darkvision: 60,
    traits: [
      { name: 'Darkflight',
        desc: 'As a Bonus Action you shape-shift into a bestial form for 1 minute, or until you end it as a Bonus '
          + 'Action. On entering it you gain Temporary Hit Points equal to twice your Proficiency Bonus. While in it '
          + 'your Speed increases by 10 feet, you have Resistance to Necrotic damage, and when a creature ends its '
          + 'turn within 5 feet of you, you can take a Reaction to move up to 10 feet without provoking Opportunity '
          + 'Attacks. You can shift a number of times equal to your Proficiency Bonus, and you regain all uses when '
          + 'you finish a Long Rest.' },
      darkvision(60),
      { name: 'Instinctual Shift',
        desc: 'When you roll Initiative with at least one use of Darkflight left, you can use it at once, with no '
          + 'action required.' },
    ],
  },
];
