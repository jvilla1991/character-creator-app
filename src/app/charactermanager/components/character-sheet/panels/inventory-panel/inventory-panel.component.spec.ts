import { of } from 'rxjs';

import { InventoryPanelComponent } from './inventory-panel.component';
import { PC, PcItem } from '../../../../models/pc';
import { CatalogItem } from '../../../../models/shop';
import { ShopService } from '../../../../services/shop.service';
import { environment } from '../../../../../../environments/environment';

describe('InventoryPanelComponent', () => {
  let component: InventoryPanelComponent;
  let shopService: jasmine.SpyObj<ShopService>;

  const basePc = (inventory: PcItem[] = []): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', inventory } as PC);

  beforeEach(() => {
    shopService = jasmine.createSpyObj<ShopService>('ShopService', ['getCatalog']);
    shopService.getCatalog.and.returnValue(of([]));
    component = new InventoryPanelComponent(shopService);
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

  it('recomputes AC when armor with a catalog formula is equipped', () => {
    // DEX defaults to 10 (+0), so leather (11 + Dex) resolves to AC 11.
    component.pc = basePc([{ name: 'Leather Armor', category: 'armor', qty: 1, armorClass: '11 + Dex modifier' }]);
    component.pc.ac = 10;
    const spy = spyOn(component.pcChange, 'emit');

    component.toggleEquipped(0);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory![0].equipped).toBe(true);
    expect(emitted.ac).toBe(11);
  });

  describe('slot-based inventory (Darker Dungeons variant)', () => {
    const withStats = (inventory: PcItem[]): PC =>
      ({ ...basePc(inventory), race: 'Human', stats: { STR: 14, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } } as PC);

    it('totals used slots from stamped bulk × qty, excluding dropped lines', () => {
      component.pc = withStats([
        { name: 'Longsword', category: 'weapon', qty: 2, bulk: 3 },
        { name: 'Anvil', category: 'gear', qty: 1, bulk: 9, status: 'dropped' },
      ]);
      expect(component.usedSlots).toBe(6);
    });

    it('computes capacity from species and STR (Medium 18 + mod)', () => {
      component.pc = withStats([]);
      expect(component.slotCapacity).toBe(20); // STR 14 → +2
    });

    it('flags encumbered only when over capacity', () => {
      component.pc = withStats([{ name: 'Crate', category: 'gear', qty: 1, bulk: 21 }]);
      expect(component.encumbered).toBe(true);

      component.pc = withStats([{ name: 'Crate', category: 'gear', qty: 1, bulk: 20 }]);
      expect(component.encumbered).toBe(false); // at capacity is fine
    });

    it('falls back to weight-band bulk for unstamped lines', () => {
      expect(component.bulkFor({ name: 'Rope', category: 'gear', qty: 1, weight: 5 })).toBe(2);
      expect(component.bulkFor({ name: 'Note', category: 'gear', qty: 1 })).toBe(1);
    });
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

  // --- DM grants ---

  describe('grant form', () => {
    const catalogLongsword: CatalogItem = {
      itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500,
      weight: 3, bulk: 2, details: { damage: '1d8 slashing', properties: ['versatile (1d10)'] },
    };

    beforeEach(() => {
      component.pc = basePc([]);
    });

    it('loads the catalog for the default category on open', () => {
      shopService.getCatalog.and.returnValue(of([catalogLongsword]));
      component.openGrantForm();
      expect(shopService.getCatalog).toHaveBeenCalledWith('WEAPON');
      expect(component.grantTab).toBe('catalog');
      expect(component.catalogItems).toEqual([catalogLongsword]);
    });

    it('denormalizes a catalog item like the backend, flattening details without clobbering base fields', () => {
      shopService.getCatalog.and.returnValue(of([catalogLongsword]));
      component.openGrantForm();
      component.catalogSelectedKey = 'longsword';
      component.catalogQty = 2;
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.grantCatalogItem();

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual({
        catalogKey: 'longsword',
        name: 'Longsword',
        category: 'weapon',
        qty: 2,
        unitCostCp: 1500,
        weight: 3,
        bulk: 2,
        damage: '1d8 slashing',
        properties: ['versatile (1d10)'],
      });
      expect(component.grantFormOpen).toBeFalse();
    });

    it('does not let details keys overwrite base fields (putIfAbsent semantics)', () => {
      const sneaky: CatalogItem = {
        itemKey: 'trap', name: 'Real Name', category: 'GEAR', costCp: 10, weight: 1, bulk: 1,
        details: { name: 'HACKED', category: 'weapon', qty: 999, extra: 'ok' },
      };
      shopService.getCatalog.and.returnValue(of([sneaky]));
      component.openGrantForm();
      component.catalogSelectedKey = 'trap';
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.grantCatalogItem();

      expect(emitted[0].name).toBe('Real Name');
      expect(emitted[0].category).toBe('gear');
      expect(emitted[0].qty).toBe(1);
      expect((emitted[0] as any).extra).toBe('ok');
    });

    it('omits weight when the catalog item has none', () => {
      const weightless: CatalogItem = { itemKey: 'gem', name: 'Gem', category: 'GEAR', costCp: 5000, weight: null, bulk: 1, details: {} };
      shopService.getCatalog.and.returnValue(of([weightless]));
      component.openGrantForm();
      component.catalogSelectedKey = 'gem';
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.grantCatalogItem();

      expect('weight' in emitted[0]).toBeFalse();
    });

    it('grants an ad-hoc custom item with no catalogKey/cost/bulk', () => {
      component.openGrantForm();
      component.setGrantTab('custom');
      component.customName = '  Cracked Dragon Fang  ';
      component.customCategory = 'gear';
      component.customQty = 1;
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));

      component.grantCustomItem();

      expect(emitted[0]).toEqual({ name: 'Cracked Dragon Fang', category: 'gear', qty: 1 });
    });

    it('blocks a custom grant with a blank name', () => {
      const emitted: PcItem[] = [];
      component.itemGranted.subscribe(i => emitted.push(i));
      component.customName = '   ';

      component.grantCustomItem();

      expect(emitted.length).toBe(0);
    });

    it('opens straight to the custom tab in demo mode (no catalog)', () => {
      // demoMode is captured at construction; build a component that reads it as true.
      spyOnProperty(environment, 'demoMode', 'get').and.returnValue(true);
      const demoComponent = new InventoryPanelComponent(shopService);
      demoComponent.pc = basePc([]);

      demoComponent.openGrantForm();

      expect(demoComponent.grantTab).toBe('custom');
      expect(shopService.getCatalog).not.toHaveBeenCalled();
    });
  });
});
