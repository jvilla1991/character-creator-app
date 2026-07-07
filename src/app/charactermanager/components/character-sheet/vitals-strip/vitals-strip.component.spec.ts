import { VitalsStripComponent } from './vitals-strip.component';
import { PC, PcItem } from '../../../models/pc';

describe('VitalsStripComponent', () => {
  let component: VitalsStripComponent;

  const basePc = (inventory: PcItem[] = []): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', inventory } as PC);

  beforeEach(() => {
    component = new VitalsStripComponent();
  });

  describe('armorLabel', () => {
    it('lists the equipped armor by name', () => {
      component.pc = basePc([
        { name: 'Chain Mail', category: 'armor', qty: 1, equipped: true },
        { name: 'Shield', category: 'armor', qty: 1, equipped: true },
        { name: 'Longsword', category: 'weapon', qty: 1, equipped: true },
      ]);
      expect(component.armorLabel).toBe('Chain Mail & Shield');
    });

    it('reports unarmored when nothing armor-like is equipped', () => {
      component.pc = basePc([
        { name: 'Leather Armor', category: 'armor', qty: 1, equipped: false },
        { name: 'Studded Leather', category: 'armor', qty: 1, equipped: true, status: 'dropped' },
      ]);
      expect(component.armorLabel).toBe('unarmored');
    });
  });

  // --- DM edit modal requests ---

  describe('requestHp', () => {
    beforeEach(() => {
      component.pc = { ...basePc(), hp: { cur: 12, max: 20, temp: 3 } };
    });

    it('current HP: label, value, min 0, max = hp.max', () => {
      const req = captureRequest(() => component.requestHp('cur'));
      expect(req).toEqual(jasmine.objectContaining({ label: 'current HP', value: 12, min: 0, max: 20 }));
    });

    it('max HP: min 0, unbounded max', () => {
      const req = captureRequest(() => component.requestHp('max'));
      expect(req).toEqual(jasmine.objectContaining({ label: 'max HP', value: 20, min: 0, max: null }));
    });

    it('temporary HP: min 0, unbounded max', () => {
      const req = captureRequest(() => component.requestHp('temp'));
      expect(req).toEqual(jasmine.objectContaining({ label: 'temporary HP', value: 3, min: 0, max: null }));
    });

    it('apply is a pure builder that clamps current within [0, max]', () => {
      const req = captureRequest(() => component.requestHp('cur'));
      const result = req.apply(25); // over max
      expect(result.hp?.cur).toBe(20);
      expect(component.pc.hp?.cur).toBe(12); // original untouched
    });
  });

  describe('requestVital', () => {
    beforeEach(() => {
      component.pc = { ...basePc(), ac: 15, init: 2, speed: 30, prof: 3 };
    });

    it('AC: label matches the backend diff vocabulary, min 0', () => {
      const req = captureRequest(() => component.requestVital('ac'));
      expect(req).toEqual(jasmine.objectContaining({ label: 'AC', value: 15, min: 0, max: null }));
    });

    it('initiative: unbounded (min null)', () => {
      const req = captureRequest(() => component.requestVital('init'));
      expect(req).toEqual(jasmine.objectContaining({ label: 'initiative', value: 2, min: null, max: null }));
    });

    it('speed: min 0', () => {
      const req = captureRequest(() => component.requestVital('speed'));
      expect(req).toEqual(jasmine.objectContaining({ label: 'speed', min: 0 }));
    });

    it('apply is a pure builder', () => {
      const req = captureRequest(() => component.requestVital('ac'));
      const result = req.apply(18);
      expect(result.ac).toBe(18);
      expect(component.pc.ac).toBe(15); // original untouched
    });
  });

  function captureRequest(trigger: () => void) {
    let captured: any;
    component.editRequested.subscribe((r: any) => (captured = r));
    trigger();
    return captured;
  }
});
