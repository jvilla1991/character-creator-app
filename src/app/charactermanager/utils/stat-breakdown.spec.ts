import { PC, PcItem } from '../models/pc';
import { SKILL_STATS, SLOT_STATS, StatAdjustment, skillStat, slotLevelOf, slotStat } from '../models/stat-adjustment';
import { withRecomputedAc } from './armor-math';
import {
  STAT_DEFINITIONS, applyAdjustments, breakdownOf, cleanAdjustments, cleanRemoved, creationAbilityLines,
  describeAdjustment, describeAdjustmentChange, describeStatSave, formatTotal, isValidAdjustment,
} from './stat-breakdown';
import { SKILL_DEFS } from './character-math';

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

  // ── Ability scores: a base plus the DM's lines ────────────────────────────

  describe('ability scores', () => {
    const soldier: StatAdjustment = { value: 2, label: 'Soldier' };
    const level4: StatAdjustment = { value: 1, label: 'Level 4 Increase' };

    it('have a definition each, named in full with the short key as the log word', () => {
      const names = (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const)
        .map(key => `${STAT_DEFINITIONS[key].label} ${STAT_DEFINITIONS[key].title}`);
      expect(names).toEqual([
        'STR Strength', 'DEX Dexterity', 'CON Constitution', 'INT Intelligence', 'WIS Wisdom', 'CHA Charisma',
      ]);
      expect(STAT_DEFINITIONS.STR.baseLabel).toBe('Base score');
      expect(STAT_DEFINITIONS.STR.removable).toBeFalsy(); // the base cannot be taken out
      expect([STAT_DEFINITIONS.STR.min, STAT_DEFINITIONS.STR.max]).toEqual([1, 30]);
      expect(STAT_DEFINITIONS.ac.baseLabel).toBeUndefined();
    });

    it('with no lines, the whole score is the base', () => {
      const b = breakdownOf(pcWith(), 'DEX');
      expect(b.auto).toEqual([{ label: 'Base score', value: 14 }]);
      expect(b.adjustments).toEqual([]);
      expect(b.unlabelled).toBe(0);
      expect(b.total).toBe(14);
    });

    it('the base is whatever the lines do not explain, so nothing is ever unlabelled', () => {
      const pc = pcWith({
        stats: { STR: 17, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        statAdjustments: { STR: [soldier, level4] },
      });
      const b = breakdownOf(pc, 'STR');
      expect(b.auto).toEqual([{ label: 'Base score', value: 14 }]);
      expect(b.adjustments).toEqual([soldier, level4]);
      expect(b.unlabelled).toBe(0);
      expect(b.total).toBe(17);
    });

    it('reads a character with no saved scores as 10', () => {
      const b = breakdownOf(pcWith({ stats: undefined }), 'WIS');
      expect(b.total).toBe(10);
      expect(b.auto).toEqual([{ label: 'Base score', value: 10 }]);
    });

    it('a new line raises the score and leaves the base alone', () => {
      const updated = applyAdjustments(pcWith(), 'STR', [level4], true);
      expect(updated.stats?.STR).toBe(11);
      expect(updated.statAdjustments).toEqual({ STR: [level4] });
      expect(breakdownOf(updated, 'STR').auto[0].value).toBe(10);
      expect(updated.stats?.CON).toBe(10); // the other scores are untouched
    });

    it('removing a line lowers the score by it', () => {
      const pc = pcWith({
        stats: { STR: 17, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        statAdjustments: { STR: [soldier, level4] },
      });
      const updated = applyAdjustments(pc, 'STR', [soldier], true);
      expect(updated.stats?.STR).toBe(16);
      expect(breakdownOf(updated, 'STR').auto[0].value).toBe(14);
    });

    it('labelling part of the base adds the line without moving the score', () => {
      const pc = pcWith({ stats: { STR: 17, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 } });
      const updated = applyAdjustments(pc, 'STR', [soldier, level4], true, { fromBase: 3 });
      expect(updated.stats?.STR).toBe(17);
      const b = breakdownOf(updated, 'STR');
      expect(b.auto).toEqual([{ label: 'Base score', value: 14 }]);
      expect(b.adjustments).toEqual([soldier, level4]);
    });

    it('one save can label part of the base and add something new', () => {
      const pc = pcWith({ stats: { STR: 15, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 } });
      const belt = { value: 2, label: 'Belt of Strength' };
      const updated = applyAdjustments(pc, 'STR', [level4, belt], true, { fromBase: 1 });
      expect(updated.stats?.STR).toBe(17);                       // only the belt is new
      expect(breakdownOf(updated, 'STR').auto[0].value).toBe(14); // the level increase came out of the base
    });

    it('keeps a score inside 1 to 30', () => {
      const high = applyAdjustments(pcWith(), 'STR', [{ value: 25, label: 'Too much' }], true);
      expect(high.stats?.STR).toBe(30);
      const low = applyAdjustments(pcWith(), 'STR', [{ value: -15, label: 'Too little' }], true);
      expect(low.stats?.STR).toBe(1);
    });

    it('fills in the other scores when none were saved', () => {
      const updated = applyAdjustments(pcWith({ stats: undefined }), 'WIS', [level4], true);
      expect(updated.stats).toEqual({ STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 11, CHA: 10 });
    });

    it('is pure and ignores a removed set, since a base cannot be taken out', () => {
      const pc = pcWith();
      const updated = applyAdjustments(pc, 'STR', [level4], true, { removed: ['Base score'] });
      expect(updated.statAdjustments).toEqual({ STR: [level4] });
      expect(updated.stats?.STR).toBe(11);
      expect(pc.stats?.STR).toBe(10);
    });

    // --- saved numbers that depend on a score ---

    it('Armor Class follows a Dexterity line, within what the armor lets through', () => {
      // Chain shirt (max 2) at DEX 14 is already at the cap: more Dexterity adds nothing.
      const capped = applyAdjustments(pcWith(), 'DEX', [{ value: 2, label: 'Gloves' }], true);
      expect(capped.stats?.DEX).toBe(16);
      expect(capped.ac).toBe(17);

      // Less Dexterity does cost AC: 12 is +1, one below the cap.
      const lower = applyAdjustments(pcWith(), 'DEX', [{ value: -2, label: 'Cursed' }], true);
      expect(lower.ac).toBe(16);
      expect(breakdownOf(lower, 'ac').unlabelled).toBe(0);
    });

    it('Armor Class follows Dexterity in full with no armor, keeping the AC lines and any unlabelled rest', () => {
      const pc = pcWith({ inventory: [], ac: 15, statAdjustments: { ac: [taunka] } }); // 10 + 2 + 1, and 2 unlabelled
      const updated = applyAdjustments(pc, 'DEX', [{ value: 4, label: 'Manual of Quickness' }], true);
      expect(updated.stats?.DEX).toBe(18);
      expect(updated.ac).toBe(17);
      expect(breakdownOf(updated, 'ac').unlabelled).toBe(2);
      expect(updated.statAdjustments).toEqual({ ac: [taunka], DEX: [{ value: 4, label: 'Manual of Quickness' }] });
    });

    it('Armor Class does not move when the Dexterity line was removed from it', () => {
      const pc = pcWith({ inventory: [], ac: 10, statAdjustments: { acRemoved: [out('Dexterity')] } });
      const updated = applyAdjustments(pc, 'DEX', [{ value: 4, label: 'Manual of Quickness' }], true);
      expect(updated.ac).toBe(10);
    });

    it('labelling part of the Dexterity base moves neither the score nor Armor Class', () => {
      const updated = applyAdjustments(pcWith({ inventory: [], ac: 12 }), 'DEX', [level4], true, { fromBase: 1 });
      expect(updated.stats?.DEX).toBe(14);
      expect(updated.ac).toBe(12);
    });

    it('leaves hit points alone when Constitution changes, like every other sheet edit', () => {
      const pc = pcWith({ hp: { cur: 20, max: 24, temp: 0 } });
      const updated = applyAdjustments(pc, 'CON', [{ value: 2, label: 'Amulet of Health' }], true);
      expect(updated.stats?.CON).toBe(12);
      expect(updated.hp).toEqual({ cur: 20, max: 24, temp: 0 });
    });

    it('leaves Armor Class alone for the other five scores', () => {
      expect(applyAdjustments(pcWith(), 'STR', [level4], true).ac).toBe(17);
    });

    // --- log wording ---

    it('logs an added line with the short ability name and the new score', () => {
      const before = pcWith();
      expect(describeStatSave('STR', before, applyAdjustments(before, 'STR', [level4], true)))
        .toBe('DM added +1 Level 4 Increase to STR (STR 10 → 11)');
    });

    it('logs part of the base being labelled as that, since the score did not move', () => {
      const before = pcWith({ stats: { STR: 17, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 } });
      const one = applyAdjustments(before, 'STR', [level4], true, { fromBase: 1 });
      expect(describeStatSave('STR', before, one))
        .toBe('DM labelled +1 of the STR base score as Level 4 Increase');

      const two = applyAdjustments(before, 'STR', [soldier, level4], true, { fromBase: 3 });
      expect(describeStatSave('STR', before, two))
        .toBe('DM labelled +2 of the STR base score as Soldier, +1 as Level 4 Increase');
    });

    it('does not mistake two new lines that cancel out for part of the base being labelled', () => {
      const before = pcWith();
      const after = applyAdjustments(before, 'STR', [{ value: 1, label: 'Blessed' }, { value: -1, label: 'Cursed' }], true);
      expect(after.stats?.STR).toBe(10);
      expect(describeStatSave('STR', before, after)).toBe('DM added +1 Blessed, -1 Cursed to STR');
    });

    it('adds the Armor Class change when it followed Dexterity', () => {
      const before = pcWith({ inventory: [], ac: 12 });
      const after = applyAdjustments(before, 'DEX', [{ value: 2, label: 'Gloves' }], true);
      expect(describeStatSave('DEX', before, after))
        .toBe('DM added +2 Gloves to DEX (DEX 14 → 16); AC 12 → 13');
    });

    it('logs an Armor Class save exactly as before', () => {
      const before = pcWith();
      expect(describeStatSave('ac', before, applyAdjustments(before, 'ac', [taunka], true)))
        .toBe('DM added +1 Taunka to AC (AC 17 → 18)');
    });
  });

  describe('creationAbilityLines', () => {
    it('records each increase under its ability, labelled with the background', () => {
      expect(creationAbilityLines([['INT', 2], ['WIS', 1]], 'Sage')).toEqual({
        INT: [{ value: 2, label: 'Sage' }],
        WIS: [{ value: 1, label: 'Sage' }],
      });
    });

    it('opens a fresh character as a base score plus the background line', () => {
      const pc = pcWith({
        stats: { STR: 8, DEX: 12, CON: 13, INT: 17, WIS: 15, CHA: 10 }, // 15 + 2 and 14 + 1
        statAdjustments: creationAbilityLines([['INT', 2], ['WIS', 1]], 'Sage'),
      });
      const b = breakdownOf(pc, 'INT');
      expect(b.auto).toEqual([{ label: 'Base score', value: 15 }]);
      expect(b.adjustments).toEqual([{ value: 2, label: 'Sage' }]);
      expect(b.total).toBe(17);
      expect(breakdownOf(pc, 'WIS').auto[0].value).toBe(14);
      expect(breakdownOf(pc, 'STR').adjustments).toEqual([]);
    });

    it('skips an increase that was not chosen, and is null when there is nothing to record', () => {
      expect(creationAbilityLines([['', 2], ['WIS', 1]], 'Sage')).toEqual({ WIS: [{ value: 1, label: 'Sage' }] });
      expect(creationAbilityLines([['', 2], ['', 1]], 'Sage')).toBeNull();
      expect(creationAbilityLines([['WIS', 0]], 'Sage')).toBeNull();
    });

    it('cuts a long source to what a label may hold, and names a missing one plainly', () => {
      const long = 'Custom Background With A Very Long Descriptive Name';
      expect(creationAbilityLines([['STR', 2]], long)?.STR?.[0].label).toBe(long.slice(0, 40).trim());
      expect(creationAbilityLines([['STR', 2]], '  ')?.STR?.[0].label).toBe('Background');
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

  it('has no base to label: a save cannot take anything out of the class table', () => {
    expect(STAT_DEFINITIONS.slot3.baseLabel).toBeUndefined();
    expect(STAT_DEFINITIONS.slot3.min).toBeUndefined();

    const next = applyAdjustments(wizard(), 'slot3', [pearl], true, { fromBase: 1 });
    expect(breakdownOf(next, 'slot3').auto).toEqual([{ label: 'Class table', value: 2 }]);
    expect(breakdownOf(next, 'slot3').total).toBe(3);
  });

  it('sits beside ability and Armor Class lines without any of them touching the others', () => {
    const level4 = { value: 1, label: 'Level 4 Increase' };
    const pc = wizard({
      stats: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 10, CHA: 10 }, ac: 12,
      statAdjustments: { INT: [level4], acRemoved: [{ value: 1, label: 'Dexterity' }] },
    });
    const next = applyAdjustments(pc, 'slot3', [pearl], true);
    expect(next.statAdjustments).toEqual({
      INT: [level4], acRemoved: [{ value: 1, label: 'Dexterity' }], slot3: [pearl],
    });
    expect(next.stats).toEqual(pc.stats);
    expect(next.ac).toBe(12);
    expect(describeStatSave('slot3', pc, next))
      .toBe('DM added +1 Pearl of Power to 3rd-level slots (3rd-level slots 2 → 3)');

    const smarter = applyAdjustments(next, 'INT', [level4, { value: 2, label: 'Headband' }], true);
    expect(smarter.stats?.INT).toBe(18);
    expect(smarter.spellSlots).toEqual(next.spellSlots);
    expect(breakdownOf(smarter, 'slot3').total).toBe(3);
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

describe('stat-breakdown (skills)', () => {
  /** WIS 14 (+2) and proficient in Perception at +2: Perception +4. */
  const scout = (overrides: Partial<PC> = {}): PC =>
    ({ id: 1, name: 'Wren', clazz: 'Ranger', level: 3, playerName: 'P', prof: 2,
       stats: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 14, CHA: 10 },
       skills: { Perception: 'prof' }, ac: 12, ...overrides } as PC);
  const observant: StatAdjustment = { value: 1, label: 'Observant' };

  it('stores each skill under its own key, one per skill on the sheet', () => {
    expect(skillStat('Perception')).toBe('skillPerception');
    expect(skillStat('Animal Handling')).toBe('skillAnimalHandling');
    expect(skillStat('Sleight')).toBe('skillSleight');
    expect(SKILL_DEFS.map(([name]) => skillStat(name))).toEqual([...SKILL_STATS]);
    expect(() => skillStat('Basket Weaving')).toThrowError(/Basket Weaving/);
  });

  it('every key fits what the server accepts as a number name', () => {
    for (const stat of SKILL_STATS) expect(stat).toMatch(/^[A-Za-z][A-Za-z0-9]{0,23}$/);
    for (const stat of SKILL_STATS) expect(stat.endsWith('Removed')).toBeFalse();
  });

  it('breaks a skill into its ability and proficiency lines, adding up exactly', () => {
    const b = breakdownOf(scout(), 'skillPerception');
    expect(b.auto.map(l => `${l.label} ${l.value}`)).toEqual(['Wisdom 2', 'Proficiency 2']);
    expect(b.adjustments).toEqual([]);
    expect(b.unlabelled).toBe(0);
    expect(b.total).toBe(4);
  });

  it('counts the DM lines in the total and never shows an unlabelled rest', () => {
    const b = breakdownOf(scout({ statAdjustments: { skillPerception: [observant] } }), 'skillPerception');
    expect(b.adjustments).toEqual([observant]);
    expect(b.unlabelled).toBe(0);
    expect(b.total).toBe(5);
  });

  it('follows an ability or proficiency change without leaving anything behind', () => {
    const pc = scout({ statAdjustments: { skillPerception: [observant] } });
    const wiser: PC = { ...pc, stats: { ...pc.stats!, WIS: 18 }, skills: { Perception: 'expert' } };
    const b = breakdownOf(wiser, 'skillPerception');
    expect(b.auto.map(l => `${l.label} ${l.value}`)).toEqual(['Wisdom 4', 'Expertise 4']);
    expect(b.total).toBe(9);
    expect(b.unlabelled).toBe(0);
  });

  it('saves only the lines: no other number on the character moves', () => {
    const pc = scout({ statAdjustments: { ac: [{ value: 1, label: 'Taunka' }] } });
    const next = applyAdjustments(pc, 'skillPerception', [observant], true);
    expect(next.statAdjustments).toEqual({ ac: [{ value: 1, label: 'Taunka' }], skillPerception: [observant] });
    expect(next.ac).toBe(12);
    expect(next.stats).toEqual(pc.stats);
    expect(next.skills).toEqual(pc.skills);
    expect(breakdownOf(next, 'skillPerception').total).toBe(5);
    expect(pc.statAdjustments).toEqual({ ac: [{ value: 1, label: 'Taunka' }] }); // input untouched
  });

  it('clears a skill whose last line is removed', () => {
    const pc = scout({ statAdjustments: { skillPerception: [observant] } });
    const next = applyAdjustments(pc, 'skillPerception', [], true);
    expect(next.statAdjustments?.skillPerception).toEqual([]);
    expect(breakdownOf(next, 'skillPerception').total).toBe(4);
  });

  it('writes the log line with signed totals', () => {
    const before = scout();
    const after = applyAdjustments(before, 'skillPerception', [observant], true);
    expect(describeStatSave('skillPerception', before, after))
      .toBe('DM added +1 Observant to Perception (Perception +4 → +5)');
  });

  it('names Sleight of Hand in full in the dialog and the log', () => {
    expect(STAT_DEFINITIONS.skillSleight.title).toBe('Sleight of Hand');
    const before = scout({ skills: {} });
    const after = applyAdjustments(before, 'skillSleight', [{ value: -1, label: 'Clumsy gloves' }], true);
    expect(describeStatSave('skillSleight', before, after))
      .toBe('DM added -1 Clumsy gloves to Sleight of Hand (Sleight of Hand +2 → +1)');
  });

  it('formats a skill total with a sign and every other number without', () => {
    expect(formatTotal('skillPerception', 4)).toBe('+4');
    expect(formatTotal('skillPerception', -1)).toBe('-1');
    expect(formatTotal('skillPerception', 0)).toBe('+0');
    expect(formatTotal('ac', 17)).toBe('17');
    expect(formatTotal('STR', 15)).toBe('15');
  });

  it('marks skills as modifiers, and does not let their calculated lines be removed', () => {
    expect(STAT_DEFINITIONS.skillPerception.modifier).toBeTrue();
    expect(STAT_DEFINITIONS.skillPerception.removable).toBeFalsy();
    expect(STAT_DEFINITIONS.ac.modifier).toBeFalsy();
    expect(STAT_DEFINITIONS.skillPerception.adjustHint).toContain('proficiency');
  });
});
