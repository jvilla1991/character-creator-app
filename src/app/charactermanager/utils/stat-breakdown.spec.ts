import { PC, PcItem } from '../models/pc';
import { SLOT_STATS, StatAdjustment, slotLevelOf, slotStat } from '../models/stat-adjustment';
import { withRecomputedAc } from './armor-math';
import {
  STAT_DEFINITIONS, applyAdjustments, breakdownOf, cleanAdjustments, cleanRemoved, describeAdjustment,
  describeAdjustmentChange, isValidAdjustment,
} from './stat-breakdown';

const armor = (name: string, armorClass: string, equipped = true): PcItem =>
  ({ name, category: 'armor', qty: 1, armorClass, equipped });

/** DEX 14 (+2) in a chain shirt and shield: 13 + 2 + 2 = 17 from the gear alone. */
const pcWith = (overrides: Partial<PC> = {}): PC =>
  ({ id: 1, name: 'Bram', clazz: 'Fighter', level: 3, playerName: 'P',
     stats: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 },
     inventory: [armor('Chain Shirt', '13 + Dex modifier (max 2)'), armor('Shield', '+2')],
     ac: 17, ...overrides } as PC);

const taunka: StatAdjustment = { value: 1, label: 'Taunka' };
/** A calculated line taken out of the total, as it is stored. */
const out = (label: string): StatAdjustment => ({ value: 1, label });

describe('stat-breakdown', () => {
  describe('breakdownOf', () => {
    it('splits AC into the automatic lines and nothing else when it all adds up', () => {
      const b = breakdownOf(pcWith(), 'ac');
      expect(b.auto.map(l => `${l.label} ${l.value}`)).toEqual(['Chain Shirt 13', 'Dexterity 2', 'Shield 2']);
      expect(b.adjustments).toEqual([]);
      expect(b.unlabelled).toBe(0);
      expect(b.total).toBe(17);
    });

    it('lists the DM lines and counts them toward the saved total', () => {
      const b = breakdownOf(pcWith({ ac: 18, statAdjustments: { ac: [taunka] } }), 'ac');
      expect(b.adjustments).toEqual([taunka]);
      expect(b.unlabelled).toBe(0);
      expect(b.total).toBe(18);
    });

    it('reports what the saved total has beyond every line as unlabelled', () => {
      const b = breakdownOf(pcWith({ ac: 20, statAdjustments: { ac: [taunka] } }), 'ac');
      expect(b.unlabelled).toBe(2); // 20 saved, 17 gear + 1 line explained
      expect(b.total).toBe(20);     // the saved number is never second-guessed
    });

    it('reports a saved total below the lines as a negative unlabelled amount', () => {
      expect(breakdownOf(pcWith({ ac: 15 }), 'ac').unlabelled).toBe(-2);
    });

    it('uses the lines as the total when nothing was ever saved', () => {
      const b = breakdownOf(pcWith({ ac: undefined, statAdjustments: { ac: [taunka] } }), 'ac');
      expect(b.total).toBe(18);
      expect(b.unlabelled).toBe(0);
    });

    it('marks a removed calculated line and leaves it out of what is explained', () => {
      const b = breakdownOf(pcWith({ ac: 15, statAdjustments: { acRemoved: [out('Dexterity')] } }), 'ac');
      expect(b.auto).toEqual([
        { label: 'Chain Shirt', value: 13 },
        { label: 'Dexterity', value: 2, removed: true },
        { label: 'Shield', value: 2 },
      ]);
      expect(b.removed).toEqual(['Dexterity']);
      expect(b.unlabelled).toBe(0); // 13 + 2 = 15, nothing left over
      expect(b.total).toBe(15);
    });

    it('never lists a removed entry among the DM lines', () => {
      const b = breakdownOf(pcWith({ ac: 16, statAdjustments: { ac: [taunka], acRemoved: [out('Dexterity')] } }), 'ac');
      expect(b.adjustments).toEqual([taunka]);
    });

    it('keeps a removed entry whose line is gone, without it counting for anything', () => {
      const b = breakdownOf(pcWith({ statAdjustments: { acRemoved: [out('Plate')] } }), 'ac');
      expect(b.removed).toEqual(['Plate']);
      expect(b.auto.some(line => line.removed)).toBeFalse();
      expect(b.unlabelled).toBe(0);
      expect(b.total).toBe(17);
    });
  });

  describe('applyAdjustments', () => {
    it('adds a line and raises the saved total by it', () => {
      const updated = applyAdjustments(pcWith(), 'ac', [taunka], true);
      expect(updated.statAdjustments).toEqual({ ac: [taunka] });
      expect(updated.ac).toBe(18);
    });

    it('removes a line and lowers the saved total by it', () => {
      const pc = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      const updated = applyAdjustments(pc, 'ac', [], true);
      expect(updated.statAdjustments).toEqual({ ac: [] });
      expect(updated.ac).toBe(17);
    });

    it('carries the unlabelled rest when asked to keep it', () => {
      const updated = applyAdjustments(pcWith({ ac: 20 }), 'ac', [taunka], true);
      expect(updated.ac).toBe(21); // 17 gear + 1 line + the 3 nobody labelled
    });

    it('drops the unlabelled rest once the DM has dealt with it', () => {
      const removed = applyAdjustments(pcWith({ ac: 20 }), 'ac', [], false);
      expect(removed.ac).toBe(17);

      // "Label it": the rest comes back as a real line, so the total does not move.
      const labelled = applyAdjustments(pcWith({ ac: 20 }), 'ac', [{ value: 3, label: 'Unarmored Defense' }], false);
      expect(labelled.ac).toBe(20);
      expect(breakdownOf(labelled, 'ac').unlabelled).toBe(0);
    });

    it('is pure: the character passed in is untouched', () => {
      const pc = pcWith();
      applyAdjustments(pc, 'ac', [taunka], true);
      expect(pc.ac).toBe(17);
      expect(pc.statAdjustments).toBeUndefined();
    });

    it('trims labels and leaves out lines the server would refuse', () => {
      const updated = applyAdjustments(pcWith(), 'ac', [
        { value: 1, label: '  Taunka ' },
        { value: 0, label: 'Nothing' },
        { value: 2, label: '   ' },
        { value: 1.5, label: 'Half' },
      ], true);
      expect(updated.statAdjustments).toEqual({ ac: [taunka] });
      expect(updated.ac).toBe(18);
    });

    it('takes a calculated line out and lowers the saved total by exactly that line', () => {
      const updated = applyAdjustments(pcWith(), 'ac', [], true, { removed: ['Dexterity'] });
      expect(updated.statAdjustments).toEqual({ ac: [], acRemoved: [out('Dexterity')] });
      expect(updated.ac).toBe(15);
      expect(breakdownOf(updated, 'ac').unlabelled).toBe(0);
    });

    it('puts a calculated line back and raises the saved total by exactly that line', () => {
      const pc = pcWith({ ac: 15, statAdjustments: { acRemoved: [out('Shield')] } });
      const updated = applyAdjustments(pc, 'ac', [], true, { removed: [] });
      expect(updated.statAdjustments).toEqual({ ac: [] }); // the companion key goes with its last entry
      expect(updated.ac).toBe(17);
      expect(breakdownOf(updated, 'ac').unlabelled).toBe(0);
    });

    it('leaves an unlabelled rest exactly as it was when a line is taken out or put back', () => {
      const pc = pcWith({ ac: 20, statAdjustments: { ac: [taunka] } }); // 2 nobody labelled
      const removed = applyAdjustments(pc, 'ac', [taunka], true, { removed: ['Shield'] });
      expect(removed.ac).toBe(18);
      expect(breakdownOf(removed, 'ac').unlabelled).toBe(2);

      const restored = applyAdjustments(removed, 'ac', [taunka], true, { removed: [] });
      expect(restored.ac).toBe(20);
      expect(breakdownOf(restored, 'ac').unlabelled).toBe(2);
    });

    it('keeps the stored removals when a save does not mention them', () => {
      const pc = pcWith({ ac: 15, statAdjustments: { acRemoved: [out('Dexterity')] } });
      const updated = applyAdjustments(pc, 'ac', [taunka], true);
      expect(updated.statAdjustments).toEqual({ acRemoved: [out('Dexterity')], ac: [taunka] });
      expect(updated.ac).toBe(16);
    });

    it('keeps a removal whose line is not there right now', () => {
      const updated = applyAdjustments(pcWith(), 'ac', [], true, { removed: ['Plate', 'Dexterity'] });
      expect(updated.statAdjustments?.acRemoved).toEqual([out('Plate'), out('Dexterity')]);
      expect(updated.ac).toBe(15); // only Dexterity is there to take out
    });

    it('a removed line stays out of the total through the next armor swap', () => {
      const noDex = applyAdjustments(pcWith(), 'ac', [], true, { removed: ['Dexterity'] }); // 15
      const unequipped = {
        ...noDex,
        inventory: noDex.inventory!.map(i => ({ ...i, equipped: false })),
      };
      const swapped = withRecomputedAc(unequipped, noDex.inventory);
      expect(swapped.ac).toBe(10); // unarmored 10, Dex still out
      expect(breakdownOf(swapped, 'ac').unlabelled).toBe(0);
    });

    it('produces a line that survives the next armor swap', () => {
      const withLine = applyAdjustments(pcWith(), 'ac', [taunka], true); // 18
      const unequipped = {
        ...withLine,
        inventory: withLine.inventory!.map(i => ({ ...i, equipped: false })),
      };
      const swapped = withRecomputedAc(unequipped, withLine.inventory);
      expect(swapped.ac).toBe(13); // unarmored 10 + Dex 2 + Taunka 1
      expect(breakdownOf(swapped, 'ac').adjustments).toEqual([taunka]);
      expect(breakdownOf(swapped, 'ac').unlabelled).toBe(0);
    });
  });

  describe('line rules', () => {
    it('accepts a whole non-zero amount with a label', () => {
      expect(isValidAdjustment(taunka)).toBeTrue();
      expect(isValidAdjustment({ value: -2, label: 'Cursed' })).toBeTrue();
    });

    it('refuses zero, fractions, out-of-range amounts and missing or overlong labels', () => {
      expect(isValidAdjustment({ value: 0, label: 'x' })).toBeFalse();
      expect(isValidAdjustment({ value: 1.5, label: 'x' })).toBeFalse();
      expect(isValidAdjustment({ value: 100, label: 'x' })).toBeFalse();
      expect(isValidAdjustment({ value: 1, label: '  ' })).toBeFalse();
      expect(isValidAdjustment({ value: 1, label: 'x'.repeat(41) })).toBeFalse();
    });

    it('caps how many lines one number can carry', () => {
      const many = Array.from({ length: 20 }, (_, i) => ({ value: 1, label: `Line ${i}` }));
      expect(cleanAdjustments(many).length).toBe(12);
    });

    it('stores removed labels trimmed, without blanks, and cut to what the server accepts', () => {
      expect(cleanRemoved(['  Dexterity ', '', '   '], [])).toEqual(['Dexterity']);
      expect(cleanRemoved(['x'.repeat(60)], [])).toEqual(['x'.repeat(40)]);
    });

    it('at the limit, drops the oldest removal that matches no line before any that does', () => {
      const stale = Array.from({ length: 12 }, (_, i) => `Old armor ${i}`);
      const kept = cleanRemoved([...stale, 'Dexterity'], [{ label: 'Dexterity', value: 2 }]);
      expect(kept.length).toBe(12);
      expect(kept).toContain('Dexterity');
      expect(kept).not.toContain('Old armor 0');
    });

    it('matches a long item name by the part that is stored', () => {
      const name = 'Adamantine Breastplate of the Unbroken Shieldwall'; // 49 characters
      const pc = pcWith({ inventory: [armor(name, '14 + Dex modifier (max 2)')], ac: 16 });
      const updated = applyAdjustments(pc, 'ac', [], true, { removed: [name] });
      expect(updated.statAdjustments?.acRemoved).toEqual([out(name.slice(0, 40).trim())]);
      expect(updated.ac).toBe(2);
      expect(breakdownOf(updated, 'ac').auto[0].removed).toBeTrue();
    });

    it('words a line with its sign', () => {
      expect(describeAdjustment(taunka)).toBe('+1 Taunka');
      expect(describeAdjustment({ value: -2, label: 'Cursed' })).toBe('-2 Cursed');
    });
  });

  describe('describeAdjustmentChange', () => {
    const log = (before: PC, after: PC): string =>
      describeAdjustmentChange('ac', breakdownOf(before, 'ac'), breakdownOf(after, 'ac'));

    it('names an added line and the new total', () => {
      const before = pcWith();
      expect(log(before, applyAdjustments(before, 'ac', [taunka], true)))
        .toBe('DM added +1 Taunka to AC (AC 17 → 18)');
    });

    it('names a removed line and the new total', () => {
      const before = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      expect(log(before, applyAdjustments(before, 'ac', [], true)))
        .toBe('DM removed +1 Taunka from AC (AC 18 → 17)');
    });

    it('reads a relabel as one line out and one in, with no total when it did not move', () => {
      const before = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      const after = applyAdjustments(before, 'ac', [{ value: 1, label: 'Tough Hide' }], true);
      expect(log(before, after)).toBe('DM added +1 Tough Hide to AC; removed +1 Taunka from AC');
    });

    it('says when an unlabelled amount was cleared', () => {
      const before = pcWith({ ac: 20 });
      expect(log(before, applyAdjustments(before, 'ac', [], false)))
        .toBe('DM cleared an unlabelled +3 on AC (AC 20 → 17)');
    });

    it('says when an unlabelled amount was given a label', () => {
      const before = pcWith({ ac: 20 });
      const after = applyAdjustments(before, 'ac', [{ value: 3, label: 'Unarmored Defense' }], false);
      expect(log(before, after)).toBe('DM labelled +3 on AC as Unarmored Defense');
    });

    it('names a calculated line taken out, with the new total', () => {
      const before = pcWith();
      expect(log(before, applyAdjustments(before, 'ac', [], true, { removed: ['Dexterity'] })))
        .toBe('DM removed the calculated Dexterity line from AC (AC 17 → 15)');
    });

    it('names several calculated lines taken out at once', () => {
      const before = pcWith();
      expect(log(before, applyAdjustments(before, 'ac', [], true, { removed: ['Dexterity', 'Shield'] })))
        .toBe('DM removed the calculated Dexterity and Shield lines from AC (AC 17 → 13)');
    });

    it('names a calculated line put back, with the new total', () => {
      const before = pcWith({ ac: 15, statAdjustments: { acRemoved: [out('Dexterity')] } });
      expect(log(before, applyAdjustments(before, 'ac', [], true, { removed: [] })))
        .toBe('DM restored the calculated Dexterity line on AC (AC 15 → 17)');
    });

    it('reports a line added and a calculated line taken out in one save', () => {
      const before = pcWith();
      expect(log(before, applyAdjustments(before, 'ac', [taunka], true, { removed: ['Shield'] })))
        .toBe('DM added +1 Taunka to AC; removed the calculated Shield line from AC (AC 17 → 16)');
    });

    it('does not report a removal that was only tidied away as a line put back', () => {
      const before = pcWith({ statAdjustments: { acRemoved: [out('Plate')] } }); // no Plate worn
      expect(log(before, applyAdjustments(before, 'ac', [taunka], true, { removed: [] })))
        .toBe('DM added +1 Taunka to AC (AC 17 → 18)');
    });

    it('tells two identical lines apart from one', () => {
      const before = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      const after = applyAdjustments(before, 'ac', [taunka, taunka], true);
      expect(log(before, after)).toBe('DM added +1 Taunka to AC (AC 18 → 19)');
    });
  });
});

// A spell level's slot maximum takes the same lines as Armor Class. The server
// owns the total (class table + lines), so the class-table line is read off it.
describe('stat-breakdown (spell slot maximums)', () => {
  const pearl: StatAdjustment = { value: 1, label: 'Pearl of Power' };
  /** A 5th-level wizard: 4 / 3 / 2 from the class table. */
  const wizard = (overrides: Partial<PC> = {}): PC =>
    ({ id: 1, name: 'Elaria', clazz: 'Wizard', level: 5, playerName: 'P',
       spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 2 } },
       ...overrides } as PC);

  it('has no removable lines: the class table always counts, whatever a save says', () => {
    expect(STAT_DEFINITIONS.slot3.removable).toBeFalsy();
    expect(STAT_DEFINITIONS.ac.removable).toBeTrue();

    const next = applyAdjustments(wizard(), 'slot3', [pearl], true, { removed: ['Class table'] });
    expect(next.statAdjustments).toEqual({ slot3: [pearl] });
    expect(breakdownOf(next, 'slot3').removed).toEqual([]);
    expect(breakdownOf(next, 'slot3').auto).toEqual([{ label: 'Class table', value: 2 }]);
    expect(breakdownOf(next, 'slot3').total).toBe(3);
  });

  it('names the nine slot keys by spell level', () => {
    expect(SLOT_STATS.length).toBe(9);
    expect(slotStat(1)).toBe('slot1');
    expect(slotStat(9)).toBe('slot9');
    expect(() => slotStat(0)).toThrow();
    expect(() => slotStat(10)).toThrow();
    expect(slotLevelOf('slot3')).toBe(3);
    expect(slotLevelOf('ac')).toBeNull();
    expect(SLOT_STATS.every(stat => !!STAT_DEFINITIONS[stat])).toBeTrue();
    expect(STAT_DEFINITIONS.slot3.title).toBe('3rd-level spell slots');
    expect(STAT_DEFINITIONS.slot3.label).toBe('3rd-level slots');
  });

  it('with no lines, the class table is the whole maximum', () => {
    const b = breakdownOf(wizard(), 'slot3');
    expect(b.auto).toEqual([{ label: 'Class table', value: 2 }]);
    expect(b.adjustments).toEqual([]);
    expect(b.unlabelled).toBe(0);
    expect(b.total).toBe(2);
  });

  it('reads the class table as the server maximum minus the DM lines', () => {
    const pc = wizard({
      spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 4, used: 2 } },
      statAdjustments: { slot3: [pearl, { value: 1, label: 'Boon of the Archmage' }] },
    });
    const b = breakdownOf(pc, 'slot3');
    expect(b.auto).toEqual([{ label: 'Class table', value: 2 }]); // 4 on the server, 2 of them from lines
    expect(b.adjustments.map(l => l.label)).toEqual(['Pearl of Power', 'Boon of the Archmage']);
    expect(b.unlabelled).toBe(0);                                  // nothing is ever left over
    expect(b.total).toBe(4);
    // Lines on one level say nothing about another.
    expect(breakdownOf(pc, 'slot2').auto).toEqual([{ label: 'Class table', value: 3 }]);
  });

  it('counts a negative line: the table gave more than the maximum shows', () => {
    const pc = wizard({
      spellSlots: { 1: { max: 3, used: 0 } },
      statAdjustments: { slot1: [{ value: -1, label: 'Cursed' }] },
    });
    expect(breakdownOf(pc, 'slot1').auto[0].value).toBe(4);
    expect(breakdownOf(pc, 'slot1').total).toBe(3);
  });

  it('a level the class does not have starts from 0', () => {
    const b = breakdownOf(wizard(), 'slot4');
    expect(b.auto).toEqual([{ label: 'Class table', value: 0 }]);
    expect(b.total).toBe(0);
  });

  it('adding a line raises the maximum the way the server will, and keeps what is spent', () => {
    const next = applyAdjustments(wizard(), 'slot3', [pearl], true);
    expect(next.statAdjustments).toEqual({ slot3: [pearl] });
    expect(next.spellSlots).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 3, used: 2 } });
  });

  it('removing a line lowers the maximum and pulls the used count down with it', () => {
    const boosted = wizard({
      spellSlots: { 3: { max: 3, used: 3 } },
      statAdjustments: { ac: [{ value: 1, label: 'Taunka' }], slot3: [pearl] },
    });
    const next = applyAdjustments(boosted, 'slot3', [], true);
    expect(next.spellSlots).toEqual({ 3: { max: 2, used: 2 } });
    expect(next.statAdjustments).toEqual({ ac: [{ value: 1, label: 'Taunka' }], slot3: [] }); // other numbers keep their lines
  });

  it('a line gives a slot level to a character whose class has none', () => {
    const fighter = wizard({ clazz: 'Fighter', spellSlots: {} });
    const next = applyAdjustments(fighter, 'slot1', [pearl], true);
    expect(next.spellSlots).toEqual({ 1: { max: 1, used: 0 } });
    expect(breakdownOf(next, 'slot1').auto[0].value).toBe(0);
    expect(breakdownOf(next, 'slot1').total).toBe(1);
  });

  it('lines that take a level to nothing drop it, as the server does', () => {
    const next = applyAdjustments(wizard(), 'slot3', [{ value: -2, label: 'Feebleminded' }], true);
    expect(next.spellSlots).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 } });
    // The lines are still there to undo, and undoing them brings the level back.
    expect(breakdownOf(next, 'slot3').total).toBe(0);
    expect(breakdownOf(next, 'slot3').auto[0].value).toBe(2);
    const undone = applyAdjustments(next, 'slot3', [], true);
    expect(undone.spellSlots?.[3]).toEqual({ max: 2, used: 0 });
  });

  it('is pure: the character passed in is untouched', () => {
    const pc = wizard();
    const before = JSON.stringify(pc);
    applyAdjustments(pc, 'slot1', [pearl], true);
    expect(JSON.stringify(pc)).toBe(before);
  });

  it('words the log line for the DM', () => {
    const before = wizard();
    const after = applyAdjustments(before, 'slot3', [pearl], true);
    expect(describeAdjustmentChange('slot3', breakdownOf(before, 'slot3'), breakdownOf(after, 'slot3')))
      .toBe('DM added +1 Pearl of Power to 3rd-level slots (3rd-level slots 2 → 3)');
    expect(describeAdjustmentChange('slot3', breakdownOf(after, 'slot3'), breakdownOf(before, 'slot3')))
      .toBe('DM removed +1 Pearl of Power from 3rd-level slots (3rd-level slots 3 → 2)');
  });

  it('gives each number its own words above the lines the DM can add', () => {
    expect(STAT_DEFINITIONS.ac.adjustHint).toContain('armor');
    expect(STAT_DEFINITIONS.slot1.adjustHint).toContain('levels up');
    expect(STAT_DEFINITIONS.slot1.adjustHint).not.toContain('armor');
  });
});
