import { Follower, STAT_BLOCK_EXAMPLE, followerToPc, parseStatBlock, pcToStatBlock } from './follower';
import { PC } from './pc';

describe('follower model', () => {
  describe('parseStatBlock', () => {
    it('fills every missing field with a rules-derived default', () => {
      const { statBlock, error } = parseStatBlock('{}');

      expect(error).toBeUndefined();
      expect(statBlock).toEqual(jasmine.objectContaining({
        clazz: 'Follower',
        level: 1,
        hp: { max: 1, cur: 1, temp: 0 },
        ac: 10,
        init: 0,
        speed: 30,
        prof: 2,
        stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        saves: [],
        skills: {},
        spells: [],
        spellSlots: {},
        inventory: [],
        features: [],
        coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      }));
    });

    it('derives AC, initiative and proficiency from DEX and level when omitted', () => {
      const { statBlock } = parseStatBlock('{ "level": 9, "stats": { "DEX": 16 } }');

      expect(statBlock?.ac).toBe(13);   // 10 + DEX mod
      expect(statBlock?.init).toBe(3);  // DEX mod
      expect(statBlock?.prof).toBe(4);  // level 9
    });

    it('accepts the common aliases a DM is likely to type', () => {
      const { statBlock } = parseStatBlock(JSON.stringify({
        class: 'Scout', species: 'Elf', hp: 22, armorClass: 15, initiative: 4,
        abilities: { strength: 8, Dex: 18 },
        savingThrows: ['dex', 'Wisdom', 'luck'],
        skills: ['Stealth', 'Perception'],
        items: ['Rope'],
      }));

      expect(statBlock?.clazz).toBe('Scout');
      expect(statBlock?.race).toBe('Elf');
      expect(statBlock?.hp).toEqual({ max: 22, cur: 22, temp: 0 });
      expect(statBlock?.ac).toBe(15);
      expect(statBlock?.init).toBe(4);
      expect(statBlock?.stats).toEqual(jasmine.objectContaining({ STR: 8, DEX: 18, CON: 10 }));
      expect(statBlock?.saves).toEqual(['DEX', 'WIS']); // unknown abilities dropped
      expect(statBlock?.skills).toEqual({ Stealth: 'prof', Perception: 'prof' });
      expect(statBlock?.inventory).toEqual([{ name: 'Rope', category: 'gear', qty: 1 }]);
    });

    it('reads an hp object, defaulting current to max', () => {
      expect(parseStatBlock('{ "hp": { "max": 30 } }').statBlock?.hp).toEqual({ max: 30, cur: 30, temp: 0 });
      expect(parseStatBlock('{ "hp": { "cur": 9, "max": 30, "temp": 4 } }').statBlock?.hp)
        .toEqual({ max: 30, cur: 9, temp: 4 });
    });

    it('normalizes spells, slot shorthand, features and inventory lines', () => {
      const { statBlock } = parseStatBlock(JSON.stringify({
        spells: ['Light', { name: 'Cure Wounds', level: 1, school: 'Abjuration', castingTime: '1 action', range: 'Touch' }],
        spellSlots: { 1: 3, 2: { max: 2, used: 5 }, 0: 4, x: 1 },
        features: ['Pack Tactics', { name: 'Sworn Shield', description: 'Guards an ally.' }],
        inventory: [{ name: 'Spear', category: 'WEAPON', damage: '1d6 piercing', quantity: 2 },
          { name: 'Odd thing', category: 'mystery' }],
      }));

      expect(statBlock?.spells?.[0]).toEqual({ name: 'Light', lvl: 0, school: '', time: '', prepared: true });
      expect(statBlock?.spells?.[1]).toEqual(jasmine.objectContaining(
        { name: 'Cure Wounds', lvl: 1, school: 'Abjuration', time: '1 action', prepared: true, range: 'Touch' }));
      // Only real slot levels survive; "used" is clamped to max.
      expect(statBlock?.spellSlots).toEqual({ 1: { max: 3, used: 0 }, 2: { max: 2, used: 2 } });
      expect(statBlock?.features).toEqual([
        { name: 'Pack Tactics', source: 'Follower', desc: '' },
        { name: 'Sworn Shield', source: 'Follower', desc: 'Guards an ally.' },
      ]);
      expect(statBlock?.inventory?.[0]).toEqual(jasmine.objectContaining(
        { name: 'Spear', category: 'weapon', qty: 2, damage: '1d6 piercing' }));
      expect(statBlock?.inventory?.[1].category).toBe('gear'); // unknown category falls back
    });

    it('explains invalid JSON and non-object input instead of throwing', () => {
      expect(parseStatBlock('{ "ac": 14, ').error).toContain('not valid JSON');
      expect(parseStatBlock('[1, 2]').error).toContain('must be a JSON object');
      expect(parseStatBlock('"guard"').error).toContain('must be a JSON object');
    });

    it('names the offending field when a value is the wrong kind', () => {
      expect(parseStatBlock('{ "ac": "sixteen" }').error).toBe('"ac" must be a number.');
      expect(parseStatBlock('{ "hp": "lots" }').error).toContain('"hp" must be a number');
      expect(parseStatBlock('{ "stats": [10, 12] }').error).toContain('"stats" must be an object');
      expect(parseStatBlock('{ "spells": "Light" }').error).toContain('"spells" must be a list');
      expect(parseStatBlock('{ "inventory": [{ "qty": 2 }] }').error).toBe('Each inventory item needs a "name".');
    });

    it('accepts the built-in example as-is', () => {
      const { statBlock, error } = parseStatBlock(STAT_BLOCK_EXAMPLE);

      expect(error).toBeUndefined();
      expect(statBlock?.clazz).toBe('Guard');
      expect(statBlock?.spellSlots).toEqual({ 1: { max: 2, used: 0 } });
      expect(statBlock?.inventory?.length).toBe(3);
    });
  });

  describe('followerToPc / pcToStatBlock', () => {
    const owner = { id: 7, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben' } as PC;
    const follower: Follower = { id: 12, pcId: 7, name: 'Brannoc', statBlock: { clazz: 'Guard', level: 2, ac: 16 } };

    it('presents the follower as a PC with a non-colliding (negative) id', () => {
      const pc = followerToPc(follower, owner);

      expect(pc.id).toBe(-12); // never a real character's id
      expect(pc.name).toBe('Brannoc');
      expect(pc.clazz).toBe('Guard');
      expect(pc.ac).toBe(16);
      expect(pc.playerName).toBe('Ben');
    });

    it('round-trips: stripping the identity back off yields the stat block', () => {
      const edited = { ...followerToPc(follower, owner), ac: 18 };

      expect(pcToStatBlock(edited)).toEqual({ clazz: 'Guard', level: 2, ac: 18 });
    });
  });
});
