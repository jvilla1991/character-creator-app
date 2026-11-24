import { DndSpell } from './dnd-api.types';
import { spellSource } from './content-source';

/**
 * Checks the shipped Arcana Unleashed spell data (the real asset, served by the
 * Karma builder): the 33 spells of the book's spell chapter, their shape, that
 * none of them shadows a spell from another file, and spot checks of the key
 * facts for a handful of them (including the three summons and a reaction).
 */
describe('Arcana Unleashed spells (arcana-unleashed-spells.json)', () => {
  const EXPECTED = [
    'Aura of Evasion', 'Battle Familiar', 'Catnap', 'Detonate', 'Disruptive Tune', 'Distorted Distance',
    'Dueling Ground', 'Enervation', 'Entrancing Mirrors', 'Festering Blast', 'Fractured Awareness', 'Grave Ground',
    'Hindsight', 'Illusory Dragon', 'Inflict Doubt', 'Invulnerability', 'Iron Body', 'Lightning Ring',
    'Moment of Prescience', "Mordenkainen's Lucubration", 'Negative Energy Flood', 'Power Word Pain',
    'Reweave Fate', 'Spirit Lantern', 'Summon Dinosaur', 'Summon Plant', 'Transfix', 'Uncertain Footing',
    'Vision of Elapsing Eons', 'Wail of the Banshee', 'Waves of Exhaustion', 'Wither and Bloom',
    'Zone of Amicability',
  ];
  const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion',
    'necromancy', 'transmutation'];
  const SUMMONS = ['Battle Familiar', 'Summon Dinosaur', 'Summon Plant'];

  let au: DndSpell[];
  let others: DndSpell[];

  beforeAll(async () => {
    const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json', 'arcana-unleashed-spells.json'];
    const [srd, phb, wow, auData] = await Promise.all(
      files.map(f => fetch(`/assets/data/spells/${f}`).then(r => r.json() as Promise<DndSpell[]>)));
    au = auData;
    others = [...srd, ...phb, ...wow];
  });

  const find = (name: string) => au.find(s => s.name === name)!;
  const texts = (s: DndSpell) =>
    [s.description, s.eli5, s.higherLevelSlot, s.material, s.castingTrigger].filter((t): t is string => !!t);

  it('has exactly the 33 book spells, each once, ordered by level then name', () => {
    expect([...au.map(s => s.name)].sort()).toEqual([...EXPECTED].sort());
    expect(new Set(au.map(s => s.name)).size).toBe(33);
    const ordered = [...au].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    expect(au.map(s => s.name)).toEqual(ordered.map(s => s.name));
  });

  it('shares no spell name (case-insensitive) with the SRD, PHB supplement or WoW files', () => {
    const taken = new Set(others.map(s => s.name.toLowerCase()));
    for (const spell of au) expect(taken.has(spell.name.toLowerCase())).withContext(spell.name).toBeFalse();
  });

  it('gives every spell the Arcana Unleashed source and a valid shape', () => {
    const casterClasses = new Set(others.flatMap(s => s.classes));
    for (const spell of au) {
      const name = spell.name;
      expect(spellSource(spell)).withContext(name).toBe('Arcana Unleashed');
      expect(SCHOOLS).withContext(name).toContain(spell.school);
      expect(Number.isInteger(spell.level) && spell.level >= 0 && spell.level <= 9).withContext(name).toBeTrue();
      expect(spell.classes.length).withContext(name).toBeGreaterThan(0);
      for (const cls of spell.classes) {
        expect(cls).withContext(name).toBe(cls.toLowerCase());
        expect(casterClasses.has(cls)).withContext(`${name}: ${cls}`).toBeTrue();
      }
      expect(spell.classes).withContext(name).not.toContain('artificer');
      expect(spell.subclasses).withContext(name).toBeUndefined();
      expect(spell.description.trim()).withContext(name).not.toBe('');
      expect(spell.eli5?.trim()).withContext(name).toBeTruthy();
      expect(JSON.stringify(spell)).withContext(name).not.toContain('TBD');
      expect(spell.components.includes('m')).withContext(name).toBe(!!spell.material);
      expect(spell.actionType === 'reaction').withContext(name).toBe(!!spell.castingTrigger);
    }
  });

  it('uses no markup in any text (the spell card shows it as plain text; the app has no italics)', () => {
    const underscore = /(^|\W)_[^_\s][^_]*_(?!\w)/;
    for (const spell of au) {
      for (const text of texts(spell)) {
        expect(underscore.test(text)).withContext(`${spell.name}: ${text}`).toBeFalse();
        expect(text.includes('*')).withContext(`${spell.name}: ${text}`).toBeFalse();
      }
    }
  });

  it('has non-empty higher-level text wherever it is present, and on all three summons', () => {
    for (const spell of au.filter(s => s.higherLevelSlot !== undefined)) {
      expect(spell.level).withContext(spell.name).toBeGreaterThan(0);
      expect(spell.higherLevelSlot!.trim()).withContext(spell.name).not.toBe('');
    }
    for (const name of SUMMONS) {
      expect(find(name).higherLevelSlot).withContext(name).toContain("spell slot's level");
    }
  });

  it('records Battle Familiar: level-2 conjuration, no Concentration, three forms and the full stat block', () => {
    const spell = find('Battle Familiar');
    expect(spell).toEqual(jasmine.objectContaining({
      level: 2, school: 'conjuration', classes: ['druid', 'warlock', 'wizard'], actionType: 'action',
      concentration: false, ritual: false, range: '10 feet', components: ['v', 's', 'm'],
      material: 'a diamond worth 25+ GP', duration: '1 hour',
    }));
    for (const part of ['Brute, Flyer, or Stalker', 'Celestial, Fey, or Fiend', 'rolls its own Initiative',
      'Find Familiar', 'Temporary Hit Points equal', "AC 11 + the spell's level (+2 more for the Brute)",
      'HP 30 (Brute) or 20 (Flyer or Stalker), + 5 for each spell level above 2', 'Fly 30 ft. (hover)',
      'STR 16 (+3)', 'Immunities: Charmed, Frightened', 'Flyby (Flyer only)', 'Talented',
      "1d8 + 3 + the spell's level Force damage", 'Prowl (Stalker only)']) {
      expect(spell.description).withContext(part).toContain(part);
    }
  });

  it('records Summon Plant: level-5 conjuration for druids and rangers with Fungus, Tree and Vine forms', () => {
    const spell = find('Summon Plant');
    expect(spell).toEqual(jasmine.objectContaining({
      level: 5, school: 'conjuration', classes: ['druid', 'ranger'], actionType: 'action',
      concentration: true, ritual: false, range: '90 feet', components: ['v', 's', 'm'],
      material: 'herbs worth 500+ GP', duration: 'up to 1 hour',
    }));
    for (const part of ['Fungus, Tree, or Vine', 'takes its turn immediately after yours', 'Large Plant',
      "AC 11 + the spell's level (+2 more for the Tree)", 'HP 50 + 10 for each spell level above 5',
      'Climb 40 ft.', 'Vulnerabilities: Fire (Tree only), Slashing (Fungus or Vine only)',
      "1d10 + 3 + the spell's level Bludgeoning damage", 'Spore Spray (Fungus only)', 'extra 3d4 Poison damage',
      'Twist Away (Vine only)']) {
      expect(spell.description).withContext(part).toContain(part);
    }
  });

  it('records Summon Dinosaur: level-6 druid conjuration with Ankylosaur, Triceratops and Tyrannosaur forms', () => {
    const spell = find('Summon Dinosaur');
    expect(spell).toEqual(jasmine.objectContaining({
      level: 6, school: 'conjuration', classes: ['druid'], actionType: 'action',
      concentration: true, ritual: false, range: '90 feet', components: ['v', 's', 'm'],
      material: 'a polished scale worth 600+ GP', duration: 'up to 1 hour',
    }));
    for (const part of ['Ankylosaur, Triceratops, or Tyrannosaur', 'Huge Beast (Dinosaur)',
      "AC 11 + the spell's level (+2 more for the Ankylosaur)", 'HP 60 + 10 for each spell level above 6',
      'STR 21 (+5)', 'Siege Monster (Ankylosaur only)', 'Tough', "2d10 + 5 + the spell's level Piercing damage",
      'Grappled condition', 'extra 1d10 Piercing damage', "1d10 + 5 + the spell's level Bludgeoning damage"]) {
      expect(spell.description).withContext(part).toContain(part);
    }
  });

  it('records Reweave Fate as a level-7 divination reaction to a failed D20 Test', () => {
    const spell = find('Reweave Fate');
    expect(spell).toEqual(jasmine.objectContaining({
      level: 7, school: 'divination', classes: ['bard', 'cleric', 'warlock', 'wizard'], actionType: 'reaction',
      concentration: false, ritual: false, range: '60 feet', components: ['s'], duration: 'Instantaneous',
      castingTrigger: 'which you take when a creature you can see within 60 feet of you fails a D20 Test',
    }));
    expect(spell.higherLevelSlot).toBeUndefined();
    for (const part of ['reroll it with Advantage', 'must use the new roll', '6d10 Temporary Hit Points']) {
      expect(spell.description).withContext(part).toContain(part);
    }
  });

  it('records Dueling Ground as a 10-minute ritual for eight classes, minus the Artificer', () => {
    expect(find('Dueling Ground')).toEqual(jasmine.objectContaining({
      level: 2, school: 'abjuration', actionType: 'action', concentration: false, ritual: true,
      castingTime: '10 minutes', range: 'Touch', components: ['v', 's', 'm'],
      material: 'a silk flag worth 100+ GP', duration: '1 hour',
      classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'],
    }));
    for (const part of ['15-foot-radius Sphere', 'two willing creatures', 'becomes Stable', 'Unconscious condition']) {
      expect(find('Dueling Ground').description).withContext(part).toContain(part);
    }
  });

  it('records Wail of the Banshee: level-9 necromancy, up to ten creatures, 50 Hit Points threshold, 12d10 Psychic', () => {
    const spell = find('Wail of the Banshee');
    expect(spell).toEqual(jasmine.objectContaining({
      level: 9, school: 'necromancy', classes: ['sorcerer', 'warlock', 'wizard'], actionType: 'action',
      concentration: false, ritual: false, range: '60 feet', components: ['v'], duration: 'Instantaneous',
    }));
    for (const part of ['up to ten creatures', '50 Hit Points or fewer dies', 'Constitution saving throw',
      '12d10 Psychic damage', 'Deafened condition for 1 hour', "can't hear you"]) {
      expect(spell.description).withContext(part).toContain(part);
    }
  });
});
