import { InventoryPanelComponent } from './inventory-panel.component';
import { PC, PcItem } from '../../../../models/pc';

describe('InventoryPanelComponent', () => {
  let component: InventoryPanelComponent;

  const basePc = (inventory: PcItem[] = []): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', inventory } as PC);

  beforeEach(() => {
    component = new InventoryPanelComponent();
    component.editable = true;
  });

  it('flags a line as dropped without removing it, and without mutating the input', () => {
    component.pc = basePc([{ name: 'Torch', category: 'gear', qty: 2 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.dropItem(0);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.length).toBe(1);
    expect(emitted.inventory![0].status).toBe('dropped');
    expect(component.pc.inventory![0].status).toBeUndefined(); // original untouched
  });

  it('removes a dropped line for good via discardItem', () => {
    component.pc = basePc([{ name: 'Arrows', category: 'gear', qty: 20, status: 'dropped' }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.discardItem(0);

    expect((spy.calls.mostRecent().args[0] as PC).inventory!.length).toBe(0);
  });

  it('toggles the equipped display flag', () => {
    component.pc = basePc([{ name: 'Shield', category: 'armor', qty: 1 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.toggleEquipped(0);

    expect((spy.calls.mostRecent().args[0] as PC).inventory![0].equipped).toBe(true);
  });

  it('sums total weight across quantities', () => {
    component.pc = basePc([
      { name: 'Rations', category: 'gear', qty: 3, weight: 2 },
      { name: 'Sword', category: 'weapon', qty: 1, weight: 3 },
    ]);
    expect(component.totalWeight).toBe(9);
  });

  describe('canSell', () => {
    const catalogItem: PcItem = { name: 'Longsword', category: 'weapon', qty: 1, catalogKey: 'longsword' };
    const adHocItem: PcItem = { name: 'Heirloom Ring', category: 'gear', qty: 1, unitCostCp: 500 };
    const priceless: PcItem = { name: 'Note', category: 'gear', qty: 1 };

    it('is false when no shop is open', () => {
      component.shopOpenForMe = false;
      expect(component.canSell(catalogItem)).toBe(false);
    });

    it('is true for a catalog item when the shop is open with no category filter (curated)', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell(catalogItem)).toBe(true);
    });

    it('is false when the standard shop category does not match the item', () => {
      component.shopOpenForMe = true;
      component.shopCategory = 'ARMOR';
      expect(component.canSell(catalogItem)).toBe(false);
    });

    it('is true when the standard shop category matches the item', () => {
      component.shopOpenForMe = true;
      component.shopCategory = 'WEAPON';
      expect(component.canSell(catalogItem)).toBe(true);
    });

    it('falls back to unitCostCp for an item with no catalogKey', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell(adHocItem)).toBe(true);
    });

    it('is false for an item with no catalogKey and no unitCostCp', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell(priceless)).toBe(false);
    });

    it('is false for a dropped item', () => {
      component.shopOpenForMe = true;
      component.shopCategory = null;
      expect(component.canSell({ ...catalogItem, status: 'dropped' })).toBe(false);
    });
  });

  it('sell() emits the requested index via sellRequested', () => {
    const spy = spyOn(component.sellRequested, 'emit');
    component.sell(2);
    expect(spy).toHaveBeenCalledWith(2);
  });
});
