import {
  advanceGameTime,
  applyAction,
  applyConsumeToPc,
  applyTimeBump,
  clampStage,
  describeGameTime,
  initialGameTime,
  normalizeGameTime,
  registerWeekday,
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

  describe('time-of-day bumps (three-segment mapping)', () => {
    const s = { hunger: 2, thirst: 2, fatigue: 2 };

    it('morning bumps hunger and thirst', () => {
      expect(applyTimeBump(s, 'morning')).toEqual({ hunger: 3, thirst: 3, fatigue: 2 });
    });

    it('noon bumps fatigue only', () => {
      expect(applyTimeBump(s, 'noon')).toEqual({ hunger: 2, thirst: 2, fatigue: 3 });
    });

    it('night bumps all three (dusk\'s bump — sleep comes before next morning)', () => {
      expect(applyTimeBump({ hunger: 6, thirst: 5, fatigue: 0 }, 'night'))
        .toEqual({ hunger: 6, thirst: 6, fatigue: 1 });
    });
  });

  describe('actions', () => {
    it('applies the book deltas floored at zero', () => {
      expect(applyAction({ hunger: 4, thirst: 0, fatigue: 0 }, 'EAT').hunger).toBe(3);
      expect(applyAction({ hunger: 0, thirst: 1, fatigue: 0 }, 'DRINK').thirst).toBe(0);
      expect(applyAction({ hunger: 0, thirst: 0, fatigue: 2 }, 'SLEEP_GOOD').fatigue).toBe(0);
      expect(applyAction({ hunger: 0, thirst: 0, fatigue: 5 }, 'SLEEP_DISTURBED').fatigue).toBe(4);
    });
  });

  describe('applyConsumeToPc', () => {
    const rations: PcItem = { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear', qty: 2 };

    it('eating decrements a rations line and relieves hunger, without mutating the input', () => {
      const pc = basePC({ survival: { hunger: 4, thirst: 0, fatigue: 0 }, inventory: [rations] });

      const after = applyConsumeToPc(pc, 'EAT');

      expect(after.survival!.hunger).toBe(3);
      expect(after.inventory![0].qty).toBe(1);
      expect(pc.inventory![0].qty).toBe(2); // input untouched
    });

    it('removes the line at the last ration and skips dropped lines', () => {
      const pc = basePC({
        survival: { hunger: 2, thirst: 0, fatigue: 0 },
        inventory: [
          { ...rations, qty: 1, status: 'dropped' },
          { ...rations, qty: 1 },
        ],
      });

      const after = applyConsumeToPc(pc, 'EAT');

      expect(after.inventory!.length).toBe(1);
      expect(after.inventory![0].status).toBe('dropped'); // the dropped line survives
    });

    it('still relieves hunger with no rations (free-form fallback)', () => {
      const after = applyConsumeToPc(basePC({ survival: { hunger: 2, thirst: 0, fatigue: 0 } }), 'EAT');
      expect(after.survival!.hunger).toBe(1);
    });

    it('sleeping leaves the inventory alone', () => {
      const pc = basePC({ survival: { hunger: 0, thirst: 0, fatigue: 3 }, inventory: [rations] });
      const after = applyConsumeToPc(pc, 'SLEEP_GOOD');
      expect(after.survival!.fatigue).toBe(0);
      expect(after.inventory).toBe(pc.inventory);
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

    it('cycles the three segments and never touches the free-text date', () => {
      expect(initialGameTime().timeOfDay).toBe('morning');
      let t = clock();
      t = advanceGameTime(t);
      expect(t.timeOfDay).toBe('noon');
      t = advanceGameTime(t);
      expect(t.timeOfDay).toBe('night');
      t = advanceGameTime(t);
      // night wraps to morning — the DATE stays; the DM edits it by hand
      expect(t.timeOfDay).toBe('morning');
      expect(t.day).toBe('3rd');
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

    it('describes the clock, skipping blank parts', () => {
      expect(describeGameTime(clock({ weekday: 'Far', week: 2 })))
        .toBe('3rd · Hammer · 1492 DR — Morning · Far · Week 2');
      expect(describeGameTime(clock())).toBe('3rd · Hammer · 1492 DR — Morning');
      expect(describeGameTime(null)).toBe('Clock not set');
    });
  });
});
