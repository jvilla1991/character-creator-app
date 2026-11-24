import { Follower, FollowerStatBlock } from './follower';
import { PC, PcSpell } from './pc';
import { DndSpell } from './dnd-api.types';
import {
  ELEMENTAL_DAMAGE_TYPES, FAMILIAR_CREATURE_TYPES, FAMILIAR_FEATS, FAMILIAR_FORMS, FOLLOWER_SPELLS,
  OTHERWORLDLY_DAMAGE_TYPES, buildSpellFollower, casterNumbers, familiarFeatsOf, followerSpellFor, hasFeat,
  slotLevelsFor,
} from './spell-followers';
import { passiveScore } from '../utils/character-math';

/**
 * A level 9 Druid with Wisdom 18: proficiency +4, spell attack +8, save DC 16.
 * Hand-built, like every character and spell here: the Arcana Unleashed spells
 * and feats arrive on other branches.
 */
const druid = (over: Partial<PC> = {}): PC => ({
  id: 7, name: 'Wren', clazz: 'Druid', level: 9, playerName: 'Sam', prof: 4,
  stats: { STR: 10, DEX: 14, CON: 14, INT: 12, WIS: 18, CHA: 8 },
  ...over,
});

const spell = (name: string, lvl: number): PcSpell =>
  ({ name, lvl, school: 'Conjuration', time: '1 action', prepared: true });

const build = (name: string, pc: PC, choices: Parameters<typeof buildSpellFollower>[2] = {}): FollowerStatBlock =>
  buildSpellFollower(name, pc, choices)!.statBlock;

const feature = (block: FollowerStatBlock, name: string) => (block.features ?? []).find(f => f.name === name);
const featureNames = (block: FollowerStatBlock) => (block.features ?? []).map(f => f.name);

describe('spell followers', () => {
  describe('which spells offer a follower', () => {
    it('exactly Find Familiar and the three Arcana Unleashed spells', () => {
      expect(FOLLOWER_SPELLS.map(s => s.name).sort())
        .toEqual(['Battle Familiar', 'Find Familiar', 'Summon Dinosaur', 'Summon Plant']);
      expect(FOLLOWER_SPELLS.map(s => [s.name, s.kind, s.level])).toEqual([
        ['Find Familiar', 'FAMILIAR', 1],
        ['Battle Familiar', 'SUMMON', 2],
        ['Summon Plant', 'SUMMON', 5],
        ['Summon Dinosaur', 'SUMMON', 6],
      ]);
    });

    it('is keyed off the name on the character\'s spell entry, whatever its case', () => {
      expect(followerSpellFor(spell('Summon Plant', 5).name)?.kind).toBe('SUMMON');
      expect(followerSpellFor('  find familiar ')?.kind).toBe('FAMILIAR');
      expect(followerSpellFor('BATTLE FAMILIAR')?.name).toBe('Battle Familiar');
    });

    it('leaves the Player\'s Handbook summons, and everything else, without one', () => {
      for (const name of ['Summon Beast', 'Summon Fey', 'Summon Undead', 'Summon Elemental', 'Summon Celestial',
        'Summon Dragon', 'Find Steed', 'Conjure Animals', 'Fireball', '', null, undefined]) {
        expect(followerSpellFor(name)).withContext(String(name)).toBeUndefined();
        expect(buildSpellFollower(name ?? '', druid())).withContext(String(name)).toBeNull();
      }
    });

    it('offers every slot from the spell\'s own level to 9, and one level for Find Familiar', () => {
      expect(slotLevelsFor(followerSpellFor('Battle Familiar')!)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      expect(slotLevelsFor(followerSpellFor('Summon Plant')!)).toEqual([5, 6, 7, 8, 9]);
      expect(slotLevelsFor(followerSpellFor('Summon Dinosaur')!)).toEqual([6, 7, 8, 9]);
      expect(slotLevelsFor(followerSpellFor('Find Familiar')!)).toEqual([1]);
    });
  });

  describe('the caster\'s numbers', () => {
    it('are the ones the Spells tab shows', () => {
      expect(casterNumbers(druid())).toEqual({ level: 9, prof: 4, spellAttack: 8, saveDc: 16 });
      // No stored proficiency: the table for the level.
      expect(casterNumbers(druid({ prof: undefined, level: 5 })))
        .toEqual({ level: 5, prof: 3, spellAttack: 7, saveDc: 15 });
    });

    it('use the best of Intelligence, Wisdom and Charisma for a class with no spellcasting ability', () => {
      const fighter = druid({ clazz: 'Fighter', level: 4, prof: 2,
        stats: { STR: 16, DEX: 12, CON: 14, INT: 8, WIS: 12, CHA: 15 } });
      expect(casterNumbers(fighter)).toEqual({ level: 4, prof: 2, spellAttack: 4, saveDc: 12 });
    });
  });

  describe('Summon Dinosaur', () => {
    it('Tyrannosaur with a level 6 slot: the base stat block', () => {
      const built = buildSpellFollower('Summon Dinosaur', druid(), { form: 'Tyrannosaur', slotLevel: 6 })!;
      const block = built.statBlock;

      expect(built.kind).toBe('SUMMON');
      expect(built.name).toBe('Tyrannosaur Spirit');
      expect(block).toEqual(jasmine.objectContaining({
        clazz: 'Dinosaur Spirit', race: 'Tyrannosaur', level: 6, alignment: 'Neutral',
        ac: 17, hp: { max: 60, cur: 60, temp: 0 }, speed: 40, init: 0, prof: 4,
        stats: { STR: 21, DEX: 11, CON: 15, INT: 4, WIS: 12, CHA: 9 },
        saves: [], skills: {}, inventory: [], spells: [],
      }));
      expect(feature(block, 'Multiattack')!.desc).toBe('Makes 3 attacks.');
      expect(feature(block, 'Tough')!.desc).toBe('+3 to its Strength and Constitution saving throws.');
      // 2d10 + 5 + the spell's level; the escape DC is the caster's spell save DC.
      expect(feature(block, 'Bite')!.desc).toContain('Melee attack: +8 to hit, reach 10 ft. Hit: 2d10 + 11 Piercing damage.');
      expect(feature(block, 'Bite')!.desc).toContain('escape DC 16');
      expect(feature(block, 'Slam')!.desc).toBe('Melee attack: +8 to hit, reach 10 ft. Hit: 1d10 + 11 Bludgeoning damage.');
      expect(feature(block, 'Gore')).toBeUndefined();
      expect(feature(block, 'Siege Monster')).toBeUndefined();
      expect(feature(block, 'Creature')).toEqual(
        { name: 'Creature', source: 'Stat block', desc: 'Huge Beast (Dinosaur), Neutral', category: 'other' });
      expect(block.bio).toContain('level 6 slot');
    });

    it('Ankylosaur with a level 9 slot: +2 AC, +10 HP a level, more attacks, bigger hits', () => {
      const block = build('Summon Dinosaur', druid(), { form: 'Ankylosaur', slotLevel: 9 });

      expect(block.ac).toBe(22);                 // 11 + 9 + 2
      expect(block.hp).toEqual({ max: 90, cur: 90, temp: 0 });
      expect(block.level).toBe(9);
      expect(feature(block, 'Multiattack')!.desc).toBe('Makes 4 attacks.');
      expect(feature(block, 'Tough')!.desc).toContain('+4');
      expect(feature(block, 'Siege Monster')!.source).toBe('Trait');
      expect(feature(block, 'Slam')!.desc).toContain('1d10 + 14 Bludgeoning');
      expect(feature(block, 'Bite')).toBeUndefined();
      expect(feature(block, 'Gore')).toBeUndefined();
    });

    it('Triceratops gores, and keeps the slam', () => {
      const block = build('Summon Dinosaur', druid(), { form: 'Triceratops', slotLevel: 7 });

      expect(block.ac).toBe(18);
      expect(block.hp!.max).toBe(70);
      expect(feature(block, 'Gore')!.desc).toContain('reach 5 ft. Hit: 1d10 + 12 Piercing damage');
      expect(feature(block, 'Gore')!.desc).toContain('1d10 more Piercing damage and is knocked Prone');
      expect(feature(block, 'Slam')).toBeDefined();
      expect(feature(block, 'Bite')).toBeUndefined();
    });
  });

  describe('Summon Plant', () => {
    it('Tree with a level 5 slot: the base stat block', () => {
      const built = buildSpellFollower('Summon Plant', druid(), { form: 'Tree', slotLevel: 5 })!;
      const block = built.statBlock;

      expect(built.kind).toBe('SUMMON');
      expect(built.name).toBe('Tree Spirit');
      expect(block).toEqual(jasmine.objectContaining({
        clazz: 'Plant Spirit', race: 'Tree', level: 5,
        ac: 18, hp: { max: 50, cur: 50, temp: 0 }, speed: 40, init: 1,
        stats: { STR: 17, DEX: 13, CON: 14, INT: 10, WIS: 13, CHA: 10 },
      }));
      expect(feature(block, 'Multiattack')!.desc).toBe('Makes 2 attacks.');
      expect(feature(block, 'Slam')!.desc).toBe('Melee attack: +8 to hit, reach 5 ft. Hit: 1d10 + 8 Bludgeoning damage.');
      expect(feature(block, 'Siege Monster')).toBeDefined();
      expect(feature(block, 'Vulnerability')!.desc).toBe('Fire damage.');
      expect(feature(block, 'Spore Spray')).toBeUndefined();
      expect(feature(block, 'Twist Away')).toBeUndefined();
      expect(feature(block, 'Movement')).toBeUndefined();
    });

    it('Fungus with a level 7 slot: no tree bonus, spores that scale, weak to slashing', () => {
      const block = build('Summon Plant', druid(), { form: 'Fungus', slotLevel: 7 });

      expect(block.ac).toBe(18);                 // 11 + 7
      expect(block.hp!.max).toBe(70);            // 50 + 10 for each level above 5
      expect(feature(block, 'Multiattack')!.desc).toBe('Makes 3 attacks.');
      expect(feature(block, 'Spore Spray')!.desc)
        .toContain('Melee or ranged attack: +8 to hit, reach 5 ft. or range 30 ft. Hit: 1d4 + 7 Poison damage');
      expect(feature(block, 'Spore Spray')!.desc).toContain('3d4 more Poison damage');
      expect(feature(block, 'Slam')).toBeUndefined();
      expect(feature(block, 'Siege Monster')).toBeUndefined();
      expect(feature(block, 'Vulnerability')!.desc).toBe('Slashing damage.');
    });

    it('Vine climbs and twists away', () => {
      const block = build('Summon Plant', druid(), { form: 'Vine', slotLevel: 5 });

      expect(block.ac).toBe(16);
      expect(feature(block, 'Movement')!.desc).toBe('Climb 40 ft.');
      expect(feature(block, 'Twist Away')!.source).toBe('Bonus Action');
      expect(feature(block, 'Slam')).toBeDefined();
      expect(feature(block, 'Vulnerability')!.desc).toBe('Slashing damage.');
    });
  });

  describe('Battle Familiar', () => {
    it('Brute with a level 2 slot: the base stat block', () => {
      const built = buildSpellFollower('Battle Familiar', druid(), { form: 'Brute', slotLevel: 2, creatureType: 'Fiend' })!;
      const block = built.statBlock;

      expect(built.kind).toBe('SUMMON');
      expect(built.name).toBe('Battle Familiar');
      expect(block).toEqual(jasmine.objectContaining({
        clazz: 'Battle Familiar (Fiend)', race: 'Brute', level: 2, alignment: 'Neutral',
        ac: 15, hp: { max: 30, cur: 30, temp: 0 }, speed: 40, init: 3,
        stats: { STR: 16, DEX: 16, CON: 12, INT: 8, WIS: 13, CHA: 10 },
        conditionImmunities: ['charmed', 'frightened'],
      }));
      expect(feature(block, 'Multiattack')!.desc).toBe('Makes 1 Rend attack.');
      expect(feature(block, 'Talented')!.desc).toBe('+1 to all of its ability checks and saving throws.');
      expect(feature(block, 'Rend')!.desc).toBe('Melee attack: +8 to hit, reach 5 ft. Hit: 1d8 + 5 Force damage.');
      expect(feature(block, 'Creature')!.desc).toBe('Medium Fiend, Neutral');
      expect(feature(block, 'Movement')!.desc).toBe('Swim 30 ft.');
      expect(feature(block, 'Flyby')).toBeUndefined();
      expect(feature(block, 'Prowl')).toBeUndefined();
    });

    it('Stalker with a level 5 slot: +5 HP a level, two attacks, Prowl', () => {
      const block = build('Battle Familiar', druid(), { form: 'Stalker', slotLevel: 5, creatureType: 'Fey' });

      expect(block.ac).toBe(16);                 // 11 + 5
      expect(block.hp).toEqual({ max: 35, cur: 35, temp: 0 }); // 20 + 5 x 3
      expect(feature(block, 'Multiattack')!.desc).toBe('Makes 2 Rend attacks. It can swap one for Prowl.');
      expect(feature(block, 'Talented')!.desc).toContain('+2');
      expect(feature(block, 'Rend')!.desc).toContain('1d8 + 8 Force damage');
      expect(feature(block, 'Prowl')).toBeDefined();
    });

    it('Flyer flies and has Flyby', () => {
      const block = build('Battle Familiar', druid(), { form: 'Flyer', slotLevel: 2 });

      expect(block.ac).toBe(13);
      expect(block.hp!.max).toBe(20);
      expect(feature(block, 'Flyby')).toBeDefined();
      expect(feature(block, 'Movement')!.desc).toBe('Fly 30 ft. (hover), Swim 30 ft.');
      expect(block.clazz).toBe('Battle Familiar (Celestial)'); // first type when none is chosen
    });

    it('empowers the current familiar: its own Hit Points and type, the battle familiar\'s as temporary ones', () => {
      const pc = druid({ feat: 'Familiar Friend', features: [{ name: 'Elemental Familiar', source: 'Feat (Level 4)', desc: '' }] });
      const owl = buildSpellFollower('Find Familiar', pc, { form: 'Owl', creatureType: 'Fey', elementalDamage: 'Cold' })!;
      const familiar: Follower = {
        id: 3, pcId: 7, name: 'Pip', kind: 'FAMILIAR',
        statBlock: { ...owl.statBlock, hp: { max: 19, cur: 12, temp: 0 } },
      };

      const built = buildSpellFollower('Battle Familiar', pc,
        { form: 'Brute', slotLevel: 3, creatureType: 'Fiend', empower: familiar })!;
      const block = built.statBlock;

      expect(built.kind).toBe('SUMMON');
      expect(built.name).toBe('Pip (Battle Familiar)');
      expect(block.hp).toEqual({ max: 19, cur: 12, temp: 35 }); // Brute 30 + 5 for level 3
      expect(block.clazz).toBe('Battle Familiar (Fey)');        // keeps the familiar's type, not the choice
      expect(block.ac).toBe(16);
      expect(block.stats!.STR).toBe(16);                         // the rest is the battle familiar's
      // What Find Familiar and its feats gave stays; the owl's own traits go.
      expect(featureNames(block)).toEqual(jasmine.arrayContaining(
        ['Rend', 'Talented', 'Familiar', 'Elemental Resistance', 'Energy Pulse']));
      expect(feature(block, 'Elemental Resistance')!.desc).toBe('Resistance to Cold damage.');
      expect(featureNames(block)).not.toContain('Talons');
      expect(block.bio).toContain('Pip');
    });

    it('a conjured one gets only the feats that speak of any familiar', () => {
      const pc = druid({
        feat: 'Familiar Friend',
        features: ['Elemental Familiar', 'Otherworldly Familiar', 'Soothing Familiar', 'Warlike Familiar']
          .map(name => ({ name, source: 'Feat', desc: '' })),
      });
      const block = build('Battle Familiar', pc, { form: 'Brute', slotLevel: 2 });

      expect(block.hp!.max).toBe(30); // Familiar Friend adds Hit Points when Find Familiar is cast
      expect(featureNames(block)).toEqual(jasmine.arrayContaining(['Healing Beacon', 'Intercept Attack']));
      expect(featureNames(block)).not.toContain('Energy Pulse');
      expect(featureNames(block)).not.toContain('Phase Walk');
    });
  });

  describe('slot level', () => {
    it('never goes below the spell\'s own level or above 9', () => {
      expect(build('Summon Dinosaur', druid(), { slotLevel: 2 }).level).toBe(6);
      expect(build('Summon Dinosaur', druid(), { slotLevel: 12 }).level).toBe(9);
      expect(build('Summon Plant', druid(), {}).level).toBe(5);
      expect(build('Battle Familiar', druid(), { slotLevel: Number.NaN }).level).toBe(2);
    });

    it('an unknown form falls back to the first one', () => {
      expect(build('Summon Plant', druid(), { form: 'Cactus' }).race).toBe('Fungus');
    });
  });

  describe('Find Familiar', () => {
    it('offers exactly the forms the spell text lists, in its order', async () => {
      const spells = await (await fetch('/assets/data/spells/srd-5.2-spells.json')).json() as DndSpell[];
      const text = spells.find(s => s.name === 'Find Familiar')!.description.replace(/\*/g, '');
      const listed = /form you choose:\s*(.+?),?\s*or another Beast/.exec(text)![1].split(/\s*,\s*/);

      expect(listed.length).toBe(11);
      expect([...FAMILIAR_FORMS]).toEqual(listed);
      expect(followerSpellFor('Find Familiar')!.forms).toEqual(FAMILIAR_FORMS);
      expect([...FAMILIAR_CREATURE_TYPES]).toEqual(['Celestial', 'Fey', 'Fiend']);
    });

    // AC, HP, walking speed, initiative, passive Perception, the attack's bonus: SRD 5.2.1.
    const EXPECTED: Record<string, [ac: number, hp: number, speed: number, init: number, passive: number, toHit: string]> = {
      Bat: [12, 1, 5, 2, 11, '+4'], Cat: [12, 2, 40, 2, 13, '+4'], Frog: [11, 1, 20, 1, 11, '+3'],
      Hawk: [13, 1, 10, 3, 16, '+5'], Lizard: [10, 2, 20, 0, 9, '+2'], Octopus: [12, 3, 5, 2, 12, '+4'],
      Owl: [11, 1, 5, 1, 15, '+3'], Rat: [10, 1, 20, 0, 12, '+2'], Raven: [12, 2, 10, 2, 13, '+4'],
      Spider: [12, 1, 20, 2, 10, '+4'], Weasel: [13, 1, 30, 3, 13, '+5'],
    };

    it('builds every form with its own numbers, as a level 1 creature with +2 proficiency', () => {
      expect(Object.keys(EXPECTED)).toEqual([...FAMILIAR_FORMS]);
      for (const form of FAMILIAR_FORMS) {
        const built = buildSpellFollower('Find Familiar', druid(), { form, creatureType: 'Fey' })!;
        const block = built.statBlock;
        const [ac, hp, speed, init, passive, toHit] = EXPECTED[form];

        expect(built.kind).withContext(form).toBe('FAMILIAR');
        expect(built.name).withContext(form).toBe(form);
        expect([block.ac, block.hp!.max, block.hp!.cur, block.speed, block.init])
          .withContext(form).toEqual([ac, hp, hp, speed, init]);
        expect([block.level, block.prof, block.race, block.clazz, block.alignment])
          .withContext(form).toEqual([1, 2, form, `Fey (${form === 'Octopus' ? 'Small' : 'Tiny'})`, 'Unaligned']);
        // Passive Perception as the app works it out from the block's Wisdom and skills.
        expect(passiveScore({ ...block, id: -1, name: form } as PC, 'Perception', 'WIS'))
          .withContext(form + ' passive Perception').toBe(passive);
        expect((block.features ?? []).filter(f => f.source === 'Action').map(f => f.desc)[0])
          .withContext(form).toContain(`Melee attack: ${toHit} to hit, reach 5 ft. Hit: 1 `);
        expect(feature(block, 'Familiar')!.source).withContext(form).toBe('Find Familiar');
        expect(feature(block, 'Creature')!.desc).withContext(form)
          .toBe(`${form === 'Octopus' ? 'Small' : 'Tiny'} Fey, Unaligned`);
        expect(block.inventory).withContext(form).toEqual([]);
      }
    });

    it('carries each form\'s skills, saves, senses, speeds and traits', () => {
      const owl = build('Find Familiar', druid(), { form: 'Owl' });
      expect(owl.stats).toEqual({ STR: 3, DEX: 13, CON: 8, INT: 2, WIS: 12, CHA: 7 });
      expect(owl.skills).toEqual({ Perception: 'expert', Stealth: 'expert' }); // +5 each
      expect(feature(owl, 'Senses')!.desc).toBe('Darkvision 120 ft.');
      expect(feature(owl, 'Movement')!.desc).toBe('Fly 60 ft.');
      expect(feature(owl, 'Flyby')!.source).toBe('Trait');
      expect(owl.clazz).toBe('Celestial (Tiny)');

      const cat = build('Find Familiar', druid(), { form: 'Cat' });
      expect(cat.saves).toEqual(['DEX']);
      expect(cat.skills).toEqual({ Perception: 'prof', Stealth: 'prof' });
      expect(feature(cat, 'Jumper')).toBeDefined();

      const octopus = build('Find Familiar', druid(), { form: 'Octopus', creatureType: 'Fiend' });
      expect(octopus.stats).toEqual({ STR: 4, DEX: 15, CON: 11, INT: 3, WIS: 10, CHA: 4 });
      expect(octopus.skills).toEqual({ Perception: 'prof', Stealth: 'expert' });
      expect(feature(octopus, 'Ink Cloud (1/Day)')!.source).toBe('Reaction');
      expect(featureNames(octopus)).toEqual(jasmine.arrayContaining(['Compression', 'Water Breathing', 'Tentacles']));
      expect(feature(octopus, 'Movement')!.desc).toBe('Swim 30 ft.');

      const hawk = build('Find Familiar', druid(), { form: 'Hawk' });
      expect(feature(hawk, 'Senses')).toBeUndefined();
      expect(hawk.skills).toEqual({ Perception: 'expert' });

      const spider = build('Find Familiar', druid(), { form: 'Spider' });
      expect(feature(spider, 'Bite')!.desc).toContain('1 Piercing damage plus 2 (1d4) Poison damage');
      expect(featureNames(spider)).toEqual(jasmine.arrayContaining(['Spider Climb', 'Web Walker']));

      expect(build('Find Familiar', druid(), { form: 'Bat' }).skills).toEqual({});
      expect(feature(build('Find Familiar', druid(), { form: 'Bat' }), 'Senses')!.desc).toBe('Blindsight 60 ft.');
      expect(build('Find Familiar', druid(), { form: 'Weasel' }).skills)
        .toEqual({ Acrobatics: 'prof', Perception: 'prof', Stealth: 'prof' });
    });

    it('without a familiar feat adds nothing beyond the form', () => {
      const block = build('Find Familiar', druid(), { form: 'Rat' });

      expect(block.hp).toEqual({ max: 1, cur: 1, temp: 0 });
      expect((block.features ?? []).map(f => f.source).filter(s => Object.values(FAMILIAR_FEATS).includes(s as never)))
        .toEqual([]);
    });
  });

  describe('familiar feats', () => {
    const withFeature = (name: string, over: Partial<PC> = {}): PC =>
      druid({ features: [{ name, source: 'Feat (Level 4)', desc: '' }], ...over });

    it('are found by name, as the origin feat or among the features, whatever the case', () => {
      expect(hasFeat(druid({ feat: 'Familiar Friend' }), 'Familiar Friend')).toBeTrue();
      expect(hasFeat(druid({ feat: ' familiar friend ' }), 'Familiar Friend')).toBeTrue();
      expect(hasFeat(withFeature('WARLIKE FAMILIAR'), 'Warlike Familiar')).toBeTrue();
      expect(hasFeat(druid({ feat: 'Magic Initiate (Druid)' }), 'Familiar Friend')).toBeFalse();
      expect(hasFeat(druid(), 'Familiar Friend')).toBeFalse();

      expect(familiarFeatsOf(druid())).toEqual(
        { friend: false, elemental: false, otherworldly: false, soothing: false, warlike: false });
      expect(familiarFeatsOf(withFeature('Soothing Familiar', { feat: 'Familiar Friend' }))).toEqual(
        { friend: true, elemental: false, otherworldly: false, soothing: true, warlike: false });
    });

    it('Familiar Friend adds twice the character\'s level to its Hit Points, maximum and current', () => {
      const origin = build('Find Familiar', druid({ feat: 'Familiar Friend', level: 9 }), { form: 'Owl' });
      expect(origin.hp).toEqual({ max: 19, cur: 19, temp: 0 }); // 1 + 2 x 9

      const viaFeature = build('Find Familiar', withFeature('Familiar Friend', { level: 3 }), { form: 'Octopus' });
      expect(viaFeature.hp).toEqual({ max: 9, cur: 9, temp: 0 }); // 3 + 2 x 3
    });

    it('Elemental Familiar adds a resistance and Energy Pulse for the chosen damage type, with the save DC baked in', () => {
      const block = build('Find Familiar', withFeature('Elemental Familiar'), { form: 'Bat', elementalDamage: 'Lightning' });

      expect(feature(block, 'Elemental Resistance')).toEqual(
        { name: 'Elemental Resistance', source: 'Elemental Familiar', desc: 'Resistance to Lightning damage.' });
      expect(feature(block, 'Energy Pulse')!.desc).toContain('DC 16 Dexterity saving throw');
      expect(feature(block, 'Energy Pulse')!.desc).toContain('2d4 Lightning damage');
      expect(block.hp!.max).toBe(1);
      // A type the feat does not offer falls back to its first.
      expect(feature(build('Find Familiar', withFeature('Elemental Familiar'), { elementalDamage: 'Radiant' }),
        'Elemental Resistance')!.desc).toBe('Resistance to Acid damage.');
      expect([...ELEMENTAL_DAMAGE_TYPES]).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
    });

    it('Otherworldly Familiar adds a resistance for the chosen damage type and Phase Walk', () => {
      const block = build('Find Familiar', withFeature('Otherworldly Familiar'), { form: 'Raven', otherworldlyDamage: 'Psychic' });

      expect(feature(block, 'Energy Resistance')).toEqual(
        { name: 'Energy Resistance', source: 'Otherworldly Familiar', desc: 'Resistance to Psychic damage.' });
      expect(feature(block, 'Phase Walk')!.source).toBe('Otherworldly Familiar');
      expect(feature(block, 'Energy Pulse')).toBeUndefined();
      expect([...OTHERWORLDLY_DAMAGE_TYPES]).toEqual(['Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder']);
    });

    it('Soothing Familiar adds Healing Beacon', () => {
      const block = build('Find Familiar', withFeature('Soothing Familiar'), { form: 'Cat' });

      expect(feature(block, 'Healing Beacon')!.source).toBe('Soothing Familiar');
      expect(feature(block, 'Healing Beacon')!.desc).toContain('treat each 1 or 2 rolled as a 3');
    });

    it('Warlike Familiar adds Intercept Attack with the character\'s proficiency bonus', () => {
      const block = build('Find Familiar', withFeature('Warlike Familiar'), { form: 'Hawk' });
      expect(feature(block, 'Intercept Attack')!.source).toBe('Warlike Familiar');
      expect(feature(block, 'Intercept Attack')!.desc).toContain('gains +4 to its Armor Class');

      const low = build('Find Familiar', withFeature('Warlike Familiar', { prof: 2 }), { form: 'Hawk' });
      expect(feature(low, 'Intercept Attack')!.desc).toContain('gains +2 to its Armor Class');
    });

    it('all five together', () => {
      const pc = druid({
        feat: 'Familiar Friend', level: 8,
        features: ['Elemental Familiar', 'Otherworldly Familiar', 'Soothing Familiar', 'Warlike Familiar']
          .map(name => ({ name, source: 'Feat', desc: '' })),
      });
      const block = build('Find Familiar', pc, { form: 'Weasel', elementalDamage: 'Fire', otherworldlyDamage: 'Radiant' });

      expect(block.hp).toEqual({ max: 17, cur: 17, temp: 0 });
      expect(featureNames(block)).toEqual(jasmine.arrayContaining(
        ['Elemental Resistance', 'Energy Pulse', 'Energy Resistance', 'Phase Walk', 'Healing Beacon', 'Intercept Attack']));
    });
  });
});
