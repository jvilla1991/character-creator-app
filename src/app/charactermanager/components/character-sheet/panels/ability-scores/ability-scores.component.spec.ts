import { AbilityScoresComponent } from './ability-scores.component';
import { PC } from '../../../../models/pc';

describe('AbilityScoresComponent', () => {
  let component: AbilityScoresComponent;

  const basePc = (): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', stats: { STR: 16, DEX: 12, CON: 14, INT: 8, WIS: 10, CHA: 13 } } as PC);

  beforeEach(() => {
    component = new AbilityScoresComponent();
    component.pc = basePc();
    component.ngOnChanges();
  });

  describe('requestScore', () => {
    it('label is the ability key itself (matches the backend diff vocabulary), min 1 max 30', () => {
      const emitted = jasmine.createSpy('emitted');
      component.editRequested.subscribe(emitted);

      component.requestScore('STR', 16);

      expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ label: 'STR', value: 16, min: 1, max: 30 }));
    });

    it('apply is a pure builder for that ability', () => {
      let captured: any;
      component.editRequested.subscribe(r => (captured = r));

      component.requestScore('STR', 16);
      const result = captured.apply(18);

      expect(result.stats.STR).toBe(18);
      expect(component.pc.stats?.STR).toBe(16); // original untouched
      // Other abilities preserved.
      expect(result.stats.DEX).toBe(12);
    });
  });
});
