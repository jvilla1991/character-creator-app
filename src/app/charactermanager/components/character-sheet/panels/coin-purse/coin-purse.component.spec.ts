import { CoinPurseComponent } from './coin-purse.component';
import { PC } from '../../../../models/pc';

describe('CoinPurseComponent', () => {
  let component: CoinPurseComponent;

  const basePc = (): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', coins: { cp: 1, sp: 2, ep: 0, gp: 10, pp: 0 } } as PC);

  beforeEach(() => {
    component = new CoinPurseComponent();
    component.pc = basePc();
  });

  describe('gpEquiv', () => {
    it('converts every denomination to its gp value', () => {
      expect(component.gpEquiv).toBe((1 / 100 + 2 / 10 + 0 / 2 + 10 + 0 * 10).toFixed(2));
    });
  });

  describe('requestCoin', () => {
    it('label is the denomination key itself, min 0, unbounded max', () => {
      const emitted = jasmine.createSpy('emitted');
      component.editRequested.subscribe(emitted);

      component.requestCoin('gp');

      expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ label: 'gp', value: 10, min: 0, max: null }));
    });

    it('apply is a pure builder for that denomination', () => {
      let captured: any;
      component.editRequested.subscribe(r => (captured = r));

      component.requestCoin('gp');
      const result = captured.apply(25);

      expect(result.coins.gp).toBe(25);
      expect(component.pc.coins?.gp).toBe(10); // original untouched
      // Other denominations preserved.
      expect(result.coins.sp).toBe(2);
    });
  });
});
