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
});
