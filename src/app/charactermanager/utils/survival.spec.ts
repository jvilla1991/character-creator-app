import {
  advanceGameTime,
  applyLongRestToPc,
  applySegmentToPc,
  clampStage,
  describeGameTime,
  incrementDayLabel,
  initialGameTime,
  isSupplyItem,
  normalizeGameTime,
  normalizeSupplies,
  registerWeekday,
  setGameTime,
  supplyBulk,
  supplyCapacity,
  SURVIVAL_LABELS,
  survivalExhaustion,
  survivalOf,
} from './survival';
import { PC, PcItem } from '../models/pc';
import { CampaignGameTime } from '../models/campaign';

const basePC = (overrides: Partial<PC> = {}): PC => ({
  id: 1,
  name: 'Valiant',
  clazz: 'Cleric',
  level: 1,
  playerName: 'Sam',
  ...overrides,
});

describe('survival util', () => {
  describe('stages', () => {
    it('defaults an untracked PC to Ok (stage 2) and clamps stored values', () => {
      expect(survivalOf(basePC())).toEqual({ hunger: 2, thirst: 2, fatigue: 2 });
      expect(survivalOf(basePC({ survival: { hunger: 9, thirst: -2, fatigue: 3 } })))
        .toEqual({ hunger: 6, thirst: 0, fatigue: 3 });
    });

    it('has seven labels per condition, from the book', () => {
      expect(SURVIVAL_LABELS.hunger.length).toBe(7);
      expect(SURVIVAL_LABELS.hunger[6]).toBe('Starving');
      expect(SURVIVAL_LABELS.thirst[5]).toBe('Dry');
      expect(SURVIVAL_LABELS.fatigue[0]).toBe('Energized');
    });

    it('clampStage bounds to 0..6', () => {
      expect(clampStage(-1)).toBe(0);
      expect(clampStage(7)).toBe(6);
      expect(clampStage(3)).toBe(3);
    });
  });

  describe('applySegmentToPc (auto-consume, container model)', () => {
    const kit: PcItem[] = [
      { catalogKey: 'ration-box', name: 'Ration box', category: 'gear', qty: 1, bulk: 1 },
      { catalogKey: 'waterskin', name: 'Waterskin', category: 'gear', qty: 1, bulk: 1 },
      { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: 5, bulk: 0.2 },
      { catalogKey: 'water', name: 'Water', category: 'gear', qty: 5, bulk: 0 },
    ];
    const fedPc = (over: Partial<PC> = {}): PC => basePC({
      survival: { hunger: 2, thirst: 2, fatigue: 2, seeded: true },
      inventory: kit.map(i => ({ ...i })),
      ...over,
    });

    it('morning: eats/drinks to hold hunger & thirst, decrementing the charge lines', () => {
      const after = applySegmentToPc(fedPc(), 'morning');
      expect(after.survival).toEqual({ hunger: 2, thirst: 2, fatigue: 2, seeded: true });
      expect(after.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(4);
      expect(after.inventory!.find(i => i.catalogKey === 'water')!.qty).toBe(4);
      // the containers themselves are never consumed
      expect(after.inventory!.find(i => i.catalogKey === 'ration-box')!.qty).toBe(1);
      expect(after.inventory!.find(i => i.catalogKey === 'waterskin')!.qty).toBe(1);
    });

    it('noon: raises fatigue only and consumes nothing', () => {
      const after = applySegmentToPc(fedPc(), 'noon');
      expect(after.survival!.fatigue).toBe(3);
      expect(after.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(5);
    });

    it('night: holds hunger/thirst when fed but always raises fatigue', () => {
      const after = applySegmentToPc(fedPc({ survival: { hunger: 3, thirst: 3, fatigue: 4, seeded: true } }), 'night');
      expect(after.survival).toEqual({ hunger: 3, thirst: 3, fatigue: 5, seeded: true });
    });

    it('raises hunger/thirst once the charges run out', () => {
      const pc = basePC({ survival: { hunger: 2, thirst: 2, fatigue: 2, seeded: true }, inventory: [] });
      const after = applySegmentToPc(pc, 'night');
      expect(after.survival).toEqual({ hunger: 3, thirst: 3, fatigue: 3, seeded: true });
    });

    it('consumes a line down to 0 and KEEPS it — empty containers persist', () => {
      const pc = fedPc({
        inventory: [
          { catalogKey: 'ration-box', name: 'Ration box', category: 'gear', qty: 1, bulk: 1 },
          { catalogKey: 'waterskin', name: 'Waterskin', category: 'gear', qty: 1, bulk: 1 },
          { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: 1, bulk: 0.2 },
          { catalogKey: 'water', name: 'Water', category: 'gear', qty: 1, bulk: 0 },
        ],
      });
      const after = applySegmentToPc(pc, 'morning');
      expect(after.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(0);
      expect(after.inventory!.find(i => i.catalogKey === 'water')!.qty).toBe(0);
      expect(after.inventory!.filter(i => i.catalogKey === 'rations').length).toBe(1);
    });

    it('seeds the starting kit once for an unseeded character', () => {
      const pc = basePC({ inventory: [] }); // no survival → unseeded
      const after = applySegmentToPc(pc, 'noon'); // noon consumes nothing, so 5 remain
      expect(after.survival!.seeded).toBeTrue();
      expect(after.inventory!.find(i => i.catalogKey === 'ration-box')!.qty).toBe(1);
      expect(after.inventory!.find(i => i.catalogKey === 'waterskin')!.qty).toBe(1);
      expect(after.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(5);
      expect(after.inventory!.find(i => i.catalogKey === 'water')!.qty).toBe(5);
    });

    it('normalizes legacy supply data: implied box added, waterskin charges become water', () => {
      // Old model: waterskin qty WAS the water servings (here 7); no box line.
      const pc = basePC({
        survival: { hunger: 2, thirst: 2, fatigue: 2, seeded: true },
        inventory: [
          { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: 3 },
          { catalogKey: 'waterskin', name: 'Waterskin', category: 'gear', qty: 7 },
        ],
      });
      const after = applySegmentToPc(pc, 'noon'); // noon consumes nothing
      expect(after.inventory!.find(i => i.catalogKey === 'ration-box')!.qty).toBe(1);
      expect(after.inventory!.find(i => i.catalogKey === 'water')!.qty).toBe(7);
      expect(after.inventory!.find(i => i.catalogKey === 'waterskin')!.qty).toBe(2); // ceil(7/5)
    });

    it('does not mutate the input PC', () => {
      const pc = fedPc();
      applySegmentToPc(pc, 'night');
      expect(pc.inventory!.find(i => i.catalogKey === 'rations')!.qty).toBe(5);
      expect(pc.inventory!.length).toBe(4);
    });
  });

  describe('supply bulk & capacity (container model)', () => {
    it('supplyBulk charges 1 per container and nothing for the servings', () => {
      expect(supplyBulk({ catalogKey: 'ration-box', name: 'Ration box', category: 'gear', qty: 2 })).toBe(2);
      expect(supplyBulk({ catalogKey: 'waterskin', name: 'Waterskin', category: 'gear', qty: 1 })).toBe(1);
      expect(supplyBulk({ catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: 10 })).toBe(0);
      expect(supplyBulk({ catalogKey: 'water', name: 'Water', category: 'gear', qty: 10 })).toBe(0);
      expect(supplyBulk({ name: 'Rope', category: 'gear', qty: 1 })).toBe(0);
    });

    it('isSupplyItem covers charges and containers — water never shows as a normal row', () => {
      expect(isSupplyItem({ catalogKey: 'rations' })).toBeTrue();
      expect(isSupplyItem({ catalogKey: 'water' })).toBeTrue();
      expect(isSupplyItem({ catalogKey: 'ration-box' })).toBeTrue();
      expect(isSupplyItem({ catalogKey: 'waterskin' })).toBeTrue();
      expect(isSupplyItem({ catalogKey: 'rope' })).toBeFalse();
    });

    it('supplyCapacity is containers × 5 per track', () => {
      const inv: PcItem[] = [
        { catalogKey: 'ration-box', name: 'Ration box', category: 'gear', qty: 2 },
        { catalogKey: 'waterskin', name: 'Waterskin', category: 'gear', qty: 1 },
      ];
      expect(supplyCapacity(inv, 'rations')).toBe(10);
      expect(supplyCapacity(inv, 'water')).toBe(5);
      expect(supplyCapacity([], 'rations')).toBe(0);
    });

    it('normalizeSupplies is idempotent and leaves converted data alone', () => {
      const converted: PcItem[] = [
        { catalogKey: 'ration-box', name: 'Ration box', category: 'gear', qty: 2 },
        { catalogKey: 'waterskin', name: 'Waterskin', category: 'gear', qty: 1 },
        { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: 4 },
        { catalogKey: 'water', name: 'Water', category: 'gear', qty: 4 },
      ];
      const out = normalizeSupplies(converted);
      expect(out.length).toBe(4);
      expect(out.find(i => i.catalogKey === 'waterskin')!.qty).toBe(1);
      expect(out.find(i => i.catalogKey === 'water')!.qty).toBe(4);
    });
  });

  describe('applyLongRestToPc', () => {
    const casterPc = (over: Partial<PC> = {}): PC => basePC({
      spellSlots: { 1: { max: 4, used: 3 }, 2: { max: 2, used: 2 } },
      survival: { hunger: 2, thirst: 2, fatigue: 5, seeded: true },
      ...over,
    });

    it('restores every spell slot and sheds 3 fatigue when undisturbed', () => {
      const after = applyLongRestToPc(casterPc(), true, true);
      expect(after.spellSlots![1].used).toBe(0);
      expect(after.spellSlots![2].used).toBe(0);
      expect(after.survival!.fatigue).toBe(2); // 5 - 3
    });

    it('sheds only 1 fatigue when disturbed', () => {
      expect(applyLongRestToPc(casterPc(), false, true).survival!.fatigue).toBe(4);
    });

    it('restores slots but leaves survival alone outside a survival campaign', () => {
      const after = applyLongRestToPc(casterPc(), true, false);
      expect(after.spellSlots![1].used).toBe(0);
      expect(after.survival!.fatigue).toBe(5); // untouched
    });
  });

  describe('survivalExhaustion', () => {
    it('adds +1 per stage 5-6 condition and −1 per stage 0, clamped to ±3', () => {
      expect(survivalExhaustion({ hunger: 5, thirst: 6, fatigue: 6 })).toBe(3);
      expect(survivalExhaustion({ hunger: 5, thirst: 3, fatigue: 0 })).toBe(0); // +1 −1
      expect(survivalExhaustion({ hunger: 0, thirst: 0, fatigue: 0 })).toBe(-3);
      expect(survivalExhaustion({ hunger: 2, thirst: 3, fatigue: 4 })).toBe(0);
    });
  });

  describe('game clock v2', () => {
    const clock = (over: Partial<CampaignGameTime> = {}): CampaignGameTime => ({
      year: '1492 DR', month: 'Hammer', day: '3rd', timeOfDay: 'morning',
      weekday: null, weekdaysSeen: [], week: 1, ...over,
    });

    it('cycles the three segments, stepping a numeric day on the rollover', () => {
      expect(initialGameTime().timeOfDay).toBe('morning');
      let t = clock();
      t = advanceGameTime(t);
      expect(t.timeOfDay).toBe('noon');
      expect(t.day).toBe('3rd');
      t = advanceGameTime(t);
      expect(t.timeOfDay).toBe('night');
      expect(t.day).toBe('3rd');
      t = advanceGameTime(t);
      // night wraps to morning: a countable day steps forward; month and year
      // stay — free text is the DM's to edit
      expect(t.timeOfDay).toBe('morning');
      expect(t.day).toBe('4th');
      expect(t.month).toBe('Hammer');
      expect(t.year).toBe('1492 DR');
    });

    it('leaves a free-text day alone on the rollover', () => {
      const t = advanceGameTime(clock({ day: 'Midwinter', timeOfDay: 'night' }));
      expect(t.timeOfDay).toBe('morning');
      expect(t.day).toBe('Midwinter'); // the clock can't count it — the DM edits by hand
    });

    it('incrementDayLabel counts numbers and ordinals, leaving the rest alone', () => {
      // bare number in → bare number out
      expect(incrementDayLabel('3')).toBe('4');
      expect(incrementDayLabel('9')).toBe('10');
      // ordinal in → correct ordinal out
      expect(incrementDayLabel('3rd')).toBe('4th');
      expect(incrementDayLabel('20th')).toBe('21st');
      expect(incrementDayLabel('21st')).toBe('22nd');
      expect(incrementDayLabel('22nd')).toBe('23rd');
      expect(incrementDayLabel('1st')).toBe('2nd');
      // the 11th–13th family always takes "th"
      expect(incrementDayLabel('10th')).toBe('11th');
      expect(incrementDayLabel('11th')).toBe('12th');
      expect(incrementDayLabel('12th')).toBe('13th');
      expect(incrementDayLabel('112th')).toBe('113th');
      // unparseable and blank pass through unchanged
      expect(incrementDayLabel('Midwinter')).toBe('Midwinter');
      expect(incrementDayLabel('the third day')).toBe('the third day');
      expect(incrementDayLabel('  ')).toBe('  ');
      expect(incrementDayLabel('')).toBe('');
    });

    it('normalizes the pre-v2 numeric shape on read', () => {
      expect(normalizeGameTime({ year: 1492, month: 3, day: 12, timeOfDay: 'dawn' }))
        .toEqual({ year: '1492', month: '3', day: '12', timeOfDay: 'morning',
                   weekday: null, weekdaysSeen: [], week: 1 });
      expect(normalizeGameTime({ timeOfDay: 'dusk' })!.timeOfDay).toBe('night');
      expect(normalizeGameTime(null)).toBeNull();
    });

    it('registerWeekday ticks the week when an entered weekday repeats', () => {
      let t = clock({ weekday: 'Sul', weekdaysSeen: ['Sul'] });
      t = registerWeekday(t, 'Mol');
      expect(t.weekdaysSeen).toEqual(['Sul', 'Mol']);
      expect(t.week).toBe(1);
      t = registerWeekday(t, 'sul'); // case-insensitive repeat = a full week
      expect(t.week).toBe(2);
      expect(t.weekdaysSeen).toEqual(['sul']); // history resets
    });

    it('registerWeekday ignores unchanged-weekday corrections and blanks', () => {
      const t = clock({ weekday: 'Mol', weekdaysSeen: ['Sul', 'Mol'] });
      expect(registerWeekday(t, 'Mol')).toEqual(t);      // resubmit = no double count
      expect(registerWeekday(t, '  ').weekdaysSeen).toEqual(['Sul', 'Mol']);
    });

    describe('defined week (weekDays)', () => {
      const week = ['Sul', 'Mol', 'Zol'];

      it('advanceGameTime walks the weekday on the night → morning rollover', () => {
        const t = advanceGameTime(clock({ timeOfDay: 'night', weekday: 'Sul' }), week);
        expect(t.timeOfDay).toBe('morning');
        expect(t.weekday).toBe('Mol');
        expect(t.week).toBe(1); // no wrap — the counter holds
      });

      it('advanceGameTime wraps past the last day and increments the week', () => {
        // "zol" — case-insensitive match, canonicalized on the way out
        const t = advanceGameTime(clock({ timeOfDay: 'night', weekday: 'zol', week: 4 }), week);
        expect(t.weekday).toBe('Sul');
        expect(t.week).toBe(5);
      });

      it('advanceGameTime leaves an unknown or null weekday untouched', () => {
        // definition edited mid-campaign — "Far" is no longer a defined day
        const orphaned = advanceGameTime(clock({ timeOfDay: 'night', weekday: 'Far', week: 3 }), week);
        expect(orphaned.weekday).toBe('Far');
        expect(orphaned.week).toBe(3);
        const unset = advanceGameTime(clock({ timeOfDay: 'night', week: 3 }), week);
        expect(unset.weekday).toBeNull();
        expect(unset.week).toBe(3);
      });

      it('advanceGameTime never moves the weekday on non-rollover segments', () => {
        let t = advanceGameTime(clock({ timeOfDay: 'morning', weekday: 'Sul' }), week); // → noon
        expect(t.weekday).toBe('Sul');
        t = advanceGameTime(t, week); // → night
        expect(t.weekday).toBe('Sul');
        expect(t.week).toBe(1);
      });

      it('advanceGameTime without a definition behaves exactly as before', () => {
        const t = advanceGameTime(clock({ timeOfDay: 'night', weekday: 'Sul' }));
        expect(t.timeOfDay).toBe('morning');
        expect(t.weekday).toBe('Sul');
        expect(t.week).toBe(1);
      });

      it('setGameTime canonicalizes the weekday and freezes weekdaysSeen', () => {
        const current = clock({ weekday: 'Zol', weekdaysSeen: ['Mol', 'Zol'] });
        // "mol" repeats a seen weekday — the fallback would tick the week and
        // reset the history; a defined week must do neither.
        const t = setGameTime(current,
          { year: '1', month: '1', day: '10th', timeOfDay: 'morning', weekday: 'mol' }, week);
        expect(t.weekday).toBe('Mol'); // defined casing
        expect(t.week).toBe(1);        // never inferred
        expect(t.weekdaysSeen).toEqual(['Mol', 'Zol']); // frozen, not reset
      });

      it('setGameTime keeps the current weekday for a blank or out-of-list entry', () => {
        const current = clock({ weekday: 'Zol' });
        expect(setGameTime(current,
          { year: '1', month: '1', day: '10th', timeOfDay: 'morning', weekday: null }, week).weekday)
          .toBe('Zol');
        expect(setGameTime(current,
          { year: '1', month: '1', day: '10th', timeOfDay: 'morning', weekday: 'Far' }, week).weekday)
          .toBe('Zol'); // mirror of the server's 400 — never coerced
      });

      it('setGameTime applies an explicit week, floored at 1', () => {
        const current = clock({ weekday: 'Sul', week: 2 });
        expect(setGameTime(current,
          { year: '1', month: '1', day: '1', timeOfDay: 'morning', weekday: 'Sul', week: 7 }, week).week)
          .toBe(7);
        expect(setGameTime(current,
          { year: '1', month: '1', day: '1', timeOfDay: 'morning', weekday: 'Sul', week: -3 }, week).week)
          .toBe(1);
        expect(setGameTime(current,
          { year: '1', month: '1', day: '1', timeOfDay: 'morning', weekday: 'Sul' }, week).week)
          .toBe(2); // no explicit week — current kept
      });

      it('setGameTime without a definition delegates to registerWeekday', () => {
        const current = clock({ weekday: 'Mol', weekdaysSeen: ['Sul', 'Mol'] });
        // "sul" was seen before → the repetition counter ticks (fallback intact),
        // and an explicit week is ignored entirely.
        const t = setGameTime(current,
          { year: '1', month: '1', day: '10th', timeOfDay: 'morning', weekday: 'sul', week: 9 });
        expect(t.week).toBe(2);
        expect(t.weekdaysSeen).toEqual(['sul']);
      });
    });

    it('describes the clock, skipping blank parts', () => {
      expect(describeGameTime(clock({ weekday: 'Far', week: 2 })))
        .toBe('3rd · Hammer · 1492 DR — Morning · Far · Week 2');
      expect(describeGameTime(clock())).toBe('3rd · Hammer · 1492 DR — Morning');
      expect(describeGameTime(null)).toBe('Clock not set');
    });
  });
});
