import { of } from 'rxjs';
import { InventoryPanelComponent } from './inventory-panel.component';
import { CatalogService } from '../../../../services/catalog.service';
import { PC, PcItem } from '../../../../models/pc';
import { ShopItem } from '../../../../models/shop';

describe('InventoryPanelComponent', () => {
  let component: InventoryPanelComponent;
  let catalog: jasmine.SpyObj<CatalogService>;

  const basePc = (inventory: PcItem[] = []): PC =>
    ({ id: 1, name: 'X', clazz: 'Fighter', level: 4, playerName: 'P', inventory } as PC);

  beforeEach(() => {
    catalog = jasmine.createSpyObj<CatalogService>('CatalogService', ['list']);
    component = new InventoryPanelComponent(catalog);
    component.editable = true;
  });

  it('increments quantity and emits an updated PC', () => {
    component.pc = basePc([{ name: 'Torch', category: 'gear', qty: 2 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.adjustQty(0, 1);

    expect(spy).toHaveBeenCalled();
    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory![0].qty).toBe(3);
    // does not mutate the original pc input
    expect(component.pc.inventory![0].qty).toBe(2);
  });

  it('removes a line when quantity drops to zero', () => {
    component.pc = basePc([{ name: 'Torch', category: 'gear', qty: 1 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.adjustQty(0, -1);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.length).toBe(0);
  });

  it('toggles the equipped display flag', () => {
    component.pc = basePc([{ name: 'Shield', category: 'armor', qty: 1 }]);
    const spy = spyOn(component.pcChange, 'emit');

    component.toggleEquipped(0);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory![0].equipped).toBe(true);
  });

  it('adds an ad-hoc item with trimmed name and clamped qty', () => {
    component.pc = basePc([]);
    const spy = spyOn(component.pcChange, 'emit');
    component.adHocName = '  Rope  ';
    component.adHocCategory = 'gear';
    component.adHocQty = 0; // clamps to 1
    component.adHocWeight = 5;

    component.addAdHoc();

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.length).toBe(1);
    expect(emitted.inventory![0]).toEqual(jasmine.objectContaining({
      name: 'Rope', category: 'gear', qty: 1, weight: 5,
    }));
    expect(component.showAdHoc).toBeFalse();
  });

  it('ignores an ad-hoc add with a blank name', () => {
    component.pc = basePc([]);
    const spy = spyOn(component.pcChange, 'emit');
    component.adHocName = '   ';

    component.addAdHoc();

    expect(spy).not.toHaveBeenCalled();
  });

  it('maps a catalog ShopItem to a denormalized PcItem', () => {
    component.pc = basePc([]);
    const spy = spyOn(component.pcChange, 'emit');
    const shopItem: ShopItem = {
      itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500, weight: 3,
      details: { damage: '1d8 slashing', properties: ['versatile'] }, stock: null,
    };

    component.addFromCatalog(shopItem);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    const item = emitted.inventory![0];
    expect(item.catalogKey).toBe('longsword');
    expect(item.name).toBe('Longsword');
    expect(item.category).toBe('weapon');
    expect(item.qty).toBe(1);
    expect(item.unitCostCp).toBe(1500);
    expect(item.weight).toBe(3);
    expect(item.damage).toBe('1d8 slashing');
    expect(item.properties).toEqual(['versatile']);
  });

  it('stacks qty when adding a catalog item that matches an existing catalogKey', () => {
    component.pc = basePc([
      { catalogKey: 'dagger', name: 'Dagger', category: 'weapon', qty: 1 },
    ]);
    const spy = spyOn(component.pcChange, 'emit');
    const shopItem: ShopItem = {
      itemKey: 'dagger', name: 'Dagger', category: 'WEAPON', costCp: 200, weight: 1,
      details: {}, stock: null,
    };

    component.addFromCatalog(shopItem);

    const emitted = spy.calls.mostRecent().args[0] as PC;
    expect(emitted.inventory!.length).toBe(1);
    expect(emitted.inventory![0].qty).toBe(2);
  });

  it('loads catalog items for the selected category', () => {
    component.pc = basePc([]);
    const items: ShopItem[] = [
      { itemKey: 'club', name: 'Club', category: 'WEAPON', costCp: 10, weight: 2, details: {}, stock: null },
    ];
    catalog.list.and.returnValue(of(items));
    component.catalogCategory = 'WEAPON';

    component.loadCatalog();

    expect(catalog.list).toHaveBeenCalledWith('WEAPON');
    expect(component.catalogItems).toEqual(items);
    expect(component.catalogLoading).toBeFalse();
  });

  it('sums total weight across quantities', () => {
    component.pc = basePc([
      { name: 'Rations', category: 'gear', qty: 3, weight: 2 },
      { name: 'Sword', category: 'weapon', qty: 1, weight: 3 },
    ]);
    expect(component.totalWeight).toBe(9);
  });
});
