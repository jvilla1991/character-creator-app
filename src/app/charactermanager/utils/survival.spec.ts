import {
  advanceGameTime,
  applyAction,
  applyConsumeToPc,
  applyTimeBump,
  clampStage,
  describeGameTime,
  initialGameTime,
  SURVIVAL_LABELS,
  survivalExhaustion,
  survivalOf,
} from './survival';
import { PC, PcItem } from '../models/pc';

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
    it('defaults an untracked PC to all zeros and clamps stored values', () => {
      expect(survivalOf(basePC())).toEqual({ hunger: 0, thirst: 0, fatigue: 0 });
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

  describe('time-of-day bumps', () => {
    const s = { hunger: 2, thirst: 2, fatigue: 2 };

    it('dawn bumps hunger and thirst', () => {
      expect(applyTimeBump(s, 'dawn')).toEqual({ hunger: 3, thirst: 3, fatigue: 2 });
    });

    it('noon bumps fatigue only', () => {
      expect(applyTimeBump(s, 'noon')).toEqual({ hunger: 2, thirst: 2, fatigue: 3 });
    });

    it('dusk bumps all three, clamped at starving', () => {
      expect(applyTimeBump({ hunger: 6, thirst: 5, fatigue: 0 }, 'dusk'))
        .toEqual({ hunger: 6, thirst: 6, fatigue: 1 });
    });

    it('night is the sleep window — no change', () => {
      expect(applyTimeBump(s, 'night')).toEqual(s);
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

  describe('game clock', () => {
    it('cycles the day segments and rolls the calendar', () => {
      let t = initialGameTime();
      expect(t).toEqual({ year: 1, month: 1, day: 1, timeOfDay: 'dawn' });
      t = advanceGameTime(t);
      expect(t.timeOfDay).toBe('noon');
      t = advanceGameTime(advanceGameTime(t)); // dusk → night
      expect(t.timeOfDay).toBe('night');
      t = advanceGameTime(t);
      expect(t).toEqual({ year: 1, month: 1, day: 2, timeOfDay: 'dawn' });
    });

    it('rolls month and year at the simplified 30/12 boundaries', () => {
      expect(advanceGameTime({ year: 1, month: 3, day: 30, timeOfDay: 'night' }))
        .toEqual({ year: 1, month: 4, day: 1, timeOfDay: 'dawn' });
      expect(advanceGameTime({ year: 1, month: 12, day: 30, timeOfDay: 'night' }))
        .toEqual({ year: 2, month: 1, day: 1, timeOfDay: 'dawn' });
    });

    it('describes the clock (and its absence) for display', () => {
      expect(describeGameTime({ year: 1492, month: 3, day: 12, timeOfDay: 'dawn' }))
        .toBe('Day 12 · Month 3 · Year 1492 — Dawn');
      expect(describeGameTime(null)).toBe('Clock not set');
    });
  });
});
