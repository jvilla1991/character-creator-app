import { FEAT_DESCRIPTIONS, ORIGIN_FEAT_OPTIONS } from '../services/dnd-resources.service';
import {
  ARCANA_FEATS, ARCANA_FEAT_NOTE, SCHOOLS_OF_MAGIC, arcanaFeat, arcanaFeatOptions, arcanaFeatPrerequisite,
  baseFeatName, hasSpellcastingOrPactMagic, highestSpellSlotLevel, isArcanaFeat, masteredSchool, schoolMasteryFeat,
} from './arcana-feats';
import { WOW_FEATS, featPrerequisite, featSource, featSourceNote, featSourceTag, isWowFeat } from './wow-feats';

describe('arcana-feats', () => {
  const names = (category: string): string[] => ARCANA_FEATS.filter(f => f.category === category).map(f => f.name);

  const SCHOOL_ADEPTS = SCHOOLS_OF_MAGIC.map(school => `${school} Adept`);
  const FAMILIAR_FEATS = ['Elemental Familiar', 'Otherworldly Familiar', 'Soothing Familiar', 'Warlike Familiar'];
  const SCHOOL_MASTERIES = SCHOOLS_OF_MAGIC.map(schoolMasteryFeat);

  // ── The table ───────────────────────────────────────────────────────────────

  it('lists the book\'s 29 feats by category, each once', () => {
    expect(names('Origin')).toEqual([
      'Arcane Artist', 'Arcane Eloquence', 'Arcane Infiltrator', 'Arcane Omens', 'Arcane Overload',
      'Arcane Safeguard', 'Arcane Undertaker', 'Familiar Friend', 'Portal Jumper', 'Transmuted Anatomy',
    ]);
    expect(names('General')).toEqual([
      'Abjuration Adept', 'Conjuration Adept', 'Divination Adept', 'Elemental Familiar', 'Enchantment Adept',
      'Evocation Adept', 'Illusion Adept', 'Magic Connoisseur', 'Necromancy Adept', 'Otherworldly Familiar',
      'Soothing Familiar', 'Spell Resistant', 'Spell Subterfuge', 'Transmutation Adept', 'Warlike Familiar',
    ]);
    expect(names('Fighting Style')).toEqual(['Arcane Warrior']);
    expect(names('Epic Boon'))
      .toEqual(['Boon of Erupting Spellpower', 'Boon of Magic School Mastery', 'Boon of the Iron Mind']);
    expect(ARCANA_FEATS.length).toBe(29);
    expect(new Set(ARCANA_FEATS.map(f => f.name)).size).toBe(29);
  });

  it('describes every feat, and no feat of another book by mistake', () => {
    for (const feat of ARCANA_FEATS) {
      expect((FEAT_DESCRIPTIONS[feat.name] ?? '').length).withContext(feat.name).toBeGreaterThan(60);
      expect(isWowFeat(feat.name)).withContext(feat.name).toBeFalse();
    }
    const described = Object.keys(FEAT_DESCRIPTIONS).filter(isArcanaFeat);
    expect(described.sort()).toEqual(ARCANA_FEATS.map(f => f.name).sort());
  });

  it('offers the ten Origin feats to every species, tagged with the book', () => {
    const offered = ORIGIN_FEAT_OPTIONS.filter(f => f.source === 'Arcana Unleashed');
    expect(offered.map(f => f.name)).toEqual(names('Origin'));
    expect(offered.every(f => !f.species && !f.repeatable)).toBeTrue();
  });

  // ── Tagging ─────────────────────────────────────────────────────────────────

  it('tags each feat Arcana Unleashed (case-insensitive), the school masteries included', () => {
    for (const name of [...ARCANA_FEATS.map(f => f.name), ...SCHOOL_MASTERIES]) {
      expect(isArcanaFeat(name)).withContext(name).toBeTrue();
      expect(isArcanaFeat(` ${name.toUpperCase()} `)).withContext(name).toBeTrue();
      expect(featSource(name)).withContext(name).toBe('Arcana Unleashed');
      expect(featSourceTag(name)).withContext(name).toBe('Arcana Unleashed');
      expect(featSourceNote(name)).withContext(name).toBe('Arcana Unleashed feat');
    }
    expect(ARCANA_FEAT_NOTE).toBe('Arcana Unleashed feat');
  });

  it('leaves the other books\' feats where they were', () => {
    for (const name of ['War Caster', 'Alert', 'Magic Initiate (Wizard)', 'Boon of Fate', 'Archery', '', null, undefined,
      'Boon of Magic School Mastery (Chronurgy)', 'Arcane Recovery']) {
      expect(isArcanaFeat(name)).withContext(String(name)).toBeFalse();
      expect(featSource(name)).withContext(String(name)).toBe('Base Game');
      expect(featSourceTag(name)).withContext(String(name)).toBeUndefined();
      expect(featSourceNote(name)).withContext(String(name)).toBeUndefined();
    }
    for (const feat of WOW_FEATS) {
      expect(featSource(feat.name)).withContext(feat.name).toBe('World of Warcraft');
      expect(featSourceNote(feat.name)).withContext(feat.name).toBe('World of Warcraft feat');
      expect(isArcanaFeat(feat.name)).withContext(feat.name).toBeFalse();
    }
  });

  it('reads a school mastery by its school and describes it by its base name', () => {
    expect(schoolMasteryFeat('Evocation')).toBe('Boon of Magic School Mastery (Evocation)');
    expect(masteredSchool('boon of magic school mastery (illusion) ')).toBe('Illusion');
    expect(masteredSchool('Boon of Magic School Mastery')).toBeUndefined();
    expect(masteredSchool('Evocation Adept')).toBeUndefined();
    expect(baseFeatName('Boon of Magic School Mastery (Necromancy)')).toBe('Boon of Magic School Mastery');
    expect(baseFeatName(' Alert ')).toBe('Alert');
    expect(baseFeatName(null)).toBe('');
    expect(arcanaFeat('Boon of Magic School Mastery (Necromancy)')?.category).toBe('Epic Boon');
  });

  // ── Prerequisites, as shown ─────────────────────────────────────────────────

  it('shows what each feat needs beyond its level', () => {
    for (const feat of [...SCHOOL_ADEPTS, 'Spell Subterfuge', 'Boon of Erupting Spellpower', ...SCHOOL_MASTERIES]) {
      expect(featPrerequisite(feat)).withContext(feat).toBe('Spellcasting or Pact Magic feature');
      expect(FEAT_DESCRIPTIONS[baseFeatName(feat)]).withContext(feat)
        .toContain('Prerequisite: Spellcasting or Pact Magic feature.');
    }
    for (const feat of FAMILIAR_FEATS) {
      expect(featPrerequisite(feat)).withContext(feat).toBe('Familiar Friend feat');
      expect(FEAT_DESCRIPTIONS[feat]).withContext(feat).toContain('Prerequisite: Familiar Friend feat.');
    }
    expect(featPrerequisite('Magic Connoisseur')).toBe('Magic Initiate feat');
    expect(FEAT_DESCRIPTIONS['Magic Connoisseur']).toContain('Prerequisite: a Magic Initiate feat.');
    for (const feat of [...names('Origin'), 'Spell Resistant', 'Arcane Warrior', 'Boon of the Iron Mind']) {
      expect(arcanaFeatPrerequisite(feat)).withContext(feat).toBeUndefined();
      expect(FEAT_DESCRIPTIONS[feat]).withContext(feat).not.toContain('Prerequisite');
    }
    // The World of Warcraft prerequisites still read as they did.
    expect(featPrerequisite('Fists of Fury')).toBe('DEX 13+, WIS 13+');
    expect(featPrerequisite('War Caster')).toBeUndefined();
  });

  // ── Descriptions ────────────────────────────────────────────────────────────

  it('names the cantrip or spell each feat gives, and what it counts', () => {
    // feat => parts its description must carry
    const parts: Record<string, string[]> = {
      'Arcane Artist': ['Minor Illusion', 'Heroic Inspiration', 'Once per Long Rest'],
      'Arcane Eloquence': ['Vicious Mockery', '1d4', 'Deception, Intimidation, or Persuasion'],
      'Arcane Infiltrator': ['Friends', 'Dodge action as a Bonus Action', 'Proficiency Bonus per Long Rest'],
      'Arcane Omens': ['Guidance', 'Reaction', '1d4', 'Proficiency Bonus per Long Rest'],
      'Arcane Overload': ['Fire Bolt', 'Evocation', 'Proficiency Bonus', 'Once per Long Rest'],
      'Arcane Safeguard': ['Resistance cantrip', 'Bonus Action', 'Help action', 'Temporary Hit Points'],
      'Arcane Undertaker': ['Necromancy cantrip', 'Cleric or Wizard', 'History', 'Medicine', 'Heroic Inspiration'],
      'Familiar Friend': ['Find Familiar is always prepared', 'twice your level', 'Advantage', 'Proficiency Bonus per Long Rest'],
      'Portal Jumper': ['Necrotic, Psychic, or Radiant', '15 feet', 'Proficiency Bonus per Long Rest'],
      'Transmuted Anatomy': ['5 feet of Speed', 'shape-shift', 'Constitution saving throw', '1d4'],
      'Elemental Familiar': ['Acid, Cold, Fire, Lightning, or Thunder', '5-foot Emanation', '2d4', 'Prone'],
      'Otherworldly Familiar': ['Necrotic, Poison, Psychic, Radiant, or Thunder', 'Difficult Terrain'],
      'Soothing Familiar': ['120 feet', '5-foot Emanation', '1 or 2', 'as a 3'],
      'Warlike Familiar': ['Battle Familiar is always prepared', 'Once per Long Rest', 'Armor Class'],
      'Magic Connoisseur': ['one level 1 spell and one level 2 spell', 'Magic Initiate', 'once per Long Rest'],
      'Spell Resistant': ['Dexterity or Constitution', 'Necrotic, Psychic, Radiant, or Thunder', '1d6'],
      'Spell Subterfuge': ['Dash and Hide', 'highest Intelligence, Wisdom, or Charisma modifier', 'Invisible'],
      'Arcane Warrior': ['two Wizard cantrips', 'Mage Hand and Ray of Frost', 'gain a level'],
      'Boon of Erupting Spellpower': ['max 30', '1 or 2', 'Prone', 'Short or Long Rest'],
      'Boon of Magic School Mastery': ['max 30', 'level 1 spell', 'level 7 or lower', 'different school'],
      'Boon of the Iron Mind': ['max 30', 'Concentration', 'Petrified or Unconscious'],
    };
    for (const [feat, expected] of Object.entries(parts)) {
      for (const part of expected) expect(FEAT_DESCRIPTIONS[feat]).withContext(`${feat}: ${part}`).toContain(part);
    }
  });

  it('writes each School Adept\'s spell table out, with its own benefit', () => {
    // feat => the spells for slot levels 1 to 5 | a phrase of its own benefit
    const TABLES = `
      Abjuration Adept => Shield, Lesser Restoration, Protection from Energy, Banishment, Mass Cure Wounds | Temporary Hit Points
      Conjuration Adept => Entangle, Misty Step, Conjure Animals, Dimension Door, Conjure Elemental | Concentration
      Divination Adept => Detect Evil and Good, Mind Spike, Clairvoyance, Divination, Scrying | Advantage or Disadvantage
      Enchantment Adept => Dissonant Whispers, Enthrall, Hold Person, Dominate Beast, Modify Memory | no Verbal, Somatic, or Material
      Evocation Adept => Chromatic Orb, Shatter, Fireball, Vitriolic Sphere, Wall of Force | Hit Point Dice
      Illusion Adept => Silent Image, Phantasmal Force, Major Image, Hallucinatory Terrain, Seeming | Investigation
      Necromancy Adept => Inflict Wounds, Ray of Enfeeblement, Vampiric Touch, Blight, Raise Dead | regain Hit Points
      Transmutation Adept => Jump, Spider Climb, Slow, Polymorph, Animate Objects | 5 feet to your Speed
    `.trim().split('\n').map(line => line.trim());
    expect(TABLES.length).toBe(8);
    for (const line of TABLES) {
      const [feat, rest] = line.split(' => ');
      const [spells, benefit] = rest.split(' | ');
      const [first, second, third, fourth, fifth] = spells.split(', ');
      expect(FEAT_DESCRIPTIONS[feat]).withContext(feat)
        .toContain(`1st ${first}; 2nd ${second}; 3rd ${third}; 4th ${fourth}; 5th ${fifth}.`);
      expect(FEAT_DESCRIPTIONS[feat]).withContext(feat).toContain(benefit);
      expect(FEAT_DESCRIPTIONS[feat]).withContext(feat).toContain('Increase Intelligence, Wisdom, or Charisma by 1 (max 20)');
    }
  });

  // ── Who may take which (demo mirror of the server) ──────────────────────────

  it('knows which classes have the Spellcasting or Pact Magic feature, and their highest slot level', () => {
    for (const caster of ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard', 'Warlock', 'Paladin', 'Ranger']) {
      for (const level of [1, 2, 4, 10, 20]) {
        expect(hasSpellcastingOrPactMagic(caster, level)).withContext(`${caster} ${level}`).toBeTrue();
      }
    }
    for (const other of ['Barbarian', 'Fighter', 'Monk', 'Rogue', '', null, undefined]) {
      expect(hasSpellcastingOrPactMagic(other, 20)).withContext(String(other)).toBeFalse();
    }
    expect(hasSpellcastingOrPactMagic(' wizard ', 1)).toBeTrue();
    // class level => highest slot level, as on the server
    expect([1, 3, 5, 7, 9, 20].map(level => highestSpellSlotLevel('Wizard', level))).toEqual([1, 2, 3, 4, 5, 9]);
    expect([4, 5, 9, 13, 17, 20].map(level => highestSpellSlotLevel('Paladin', level))).toEqual([1, 2, 3, 4, 5, 5]);
    expect([2, 3, 5, 7, 9, 20].map(level => highestSpellSlotLevel('Warlock', level))).toEqual([1, 2, 3, 4, 5, 5]);
    expect(highestSpellSlotLevel('Fighter', 20)).toBe(0);
  });

  it('offers the General feats from level 4, each behind its prerequisite', () => {
    const wizard = arcanaFeatOptions({ clazz: 'Wizard', newLevel: 4, feats: ['Familiar Friend', 'Magic Initiate (Wizard)'] });
    expect([...wizard].sort()).toEqual(names('General').sort());

    const fighter = arcanaFeatOptions({ clazz: 'Fighter', newLevel: 4, feats: [] });
    expect([...fighter].sort()).toEqual(['Arcane Warrior', 'Spell Resistant']);

    for (const caster of ['Cleric', 'Warlock', 'Paladin', 'Ranger']) {
      const options = arcanaFeatOptions({ clazz: caster, newLevel: 4, feats: [] });
      for (const feat of [...SCHOOL_ADEPTS, 'Spell Subterfuge']) expect(options).withContext(caster).toContain(feat);
      for (const feat of [...FAMILIAR_FEATS, 'Magic Connoisseur']) expect(options).withContext(caster).not.toContain(feat);
    }
    expect(arcanaFeatOptions({ clazz: 'Wizard', newLevel: 3, feats: [] })).toEqual([]);
  });

  it('opens the familiar feats with Familiar Friend and Magic Connoisseur with any Magic Initiate', () => {
    const rogue = arcanaFeatOptions({ clazz: 'Rogue', newLevel: 4, feats: ['Sneak Attack', ' familiar friend '] });
    expect([...rogue].sort()).toEqual([...FAMILIAR_FEATS, 'Spell Resistant'].sort());
    for (const initiate of ['Magic Initiate (Cleric)', 'Magic Initiate (Druid)', 'magic initiate (wizard)']) {
      expect(arcanaFeatOptions({ clazz: 'Barbarian', newLevel: 8, feats: [initiate] })).withContext(initiate)
        .toEqual(['Magic Connoisseur', 'Spell Resistant']);
    }
  });

  it('offers Arcane Warrior to the classes with the Fighting Style feature only', () => {
    for (const clazz of ['Fighter', 'Paladin', 'Ranger']) {
      expect(arcanaFeatOptions({ clazz, newLevel: 4, feats: [] })).withContext(clazz).toContain('Arcane Warrior');
    }
    for (const clazz of ['Wizard', 'Barbarian', 'Rogue', null]) {
      expect(arcanaFeatOptions({ clazz, newLevel: 4, feats: [] })).withContext(String(clazz)).not.toContain('Arcane Warrior');
    }
  });

  it('offers the Epic Boons from level 19, the spell ones to casters, a mastery once per school', () => {
    const wizard = arcanaFeatOptions({ clazz: 'Wizard', newLevel: 19, feats: [] });
    for (const boon of ['Boon of Erupting Spellpower', 'Boon of the Iron Mind', ...SCHOOL_MASTERIES]) {
      expect(wizard).withContext(boon).toContain(boon);
    }
    expect(wizard).not.toContain('Boon of Magic School Mastery');

    const fighter = arcanaFeatOptions({ clazz: 'Fighter', newLevel: 19, feats: [] });
    expect(fighter).toContain('Boon of the Iron Mind');
    expect(fighter).not.toContain('Boon of Erupting Spellpower');
    expect(fighter.filter(f => f.startsWith('Boon of Magic School Mastery'))).toEqual([]);

    expect(arcanaFeatOptions({ clazz: 'Wizard', newLevel: 16, feats: [] }).filter(f => f.startsWith('Boon'))).toEqual([]);

    const taken = arcanaFeatOptions({
      clazz: 'Wizard', newLevel: 19,
      feats: ['Boon of Magic School Mastery (Evocation)', 'boon of magic school mastery (illusion)'],
    });
    expect(taken.filter(f => f.startsWith('Boon of Magic School Mastery'))).toEqual(
      ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Necromancy', 'Transmutation'].map(schoolMasteryFeat));
  });

  it('does not offer a feat the character already has', () => {
    const options = arcanaFeatOptions({
      clazz: 'Paladin', newLevel: 8, feats: ['Evocation Adept', 'spell resistant', 'Arcane Warrior'],
    });
    for (const feat of ['Evocation Adept', 'Spell Resistant', 'Arcane Warrior']) expect(options).not.toContain(feat);
    expect(options).toContain('Abjuration Adept');
  });
});
