import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CuratedShopsComponent } from './curated-shops.component';
import { Campaign } from '../../../models/campaign';
import { CuratedShop, ShopSummary } from '../../../models/curated-shop';
import { CuratedShopService } from '../../../services/curated-shop.service';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CuratedShopsComponent', () => {
  let component: CuratedShopsComponent;
  let service: any;

  const campaign = { id: '1', name: 'The Veiled Compass' } as unknown as Campaign;

  const shop: CuratedShop = {
    id: 5, campaignId: 1, name: 'Smithy', settlement: 'Phandalin',
    items: [{
      id: 9, catalogItemKey: 'longsword', name: 'Longsword', category: 'WEAPON',
      priceOverrideCp: null, effectiveCostCp: 1500, weight: 3, details: {},
    }],
  };

  beforeEach(() => {
    service = jasmine.createSpyObj('CuratedShopService',
      ['list', 'create', 'get', 'update', 'delete', 'addItem', 'updateItem', 'removeItem', 'importCategory']);
    service.list.and.returnValue(of([] as ShopSummary[]));
    component = TestBed.runInInjectionContext(() => new CuratedShopsComponent(service));
    component.campaign = campaign;
  });

  it('loads shops when the campaign changes', () => {
    const summaries: ShopSummary[] = [{ id: 5, campaignId: 1, name: 'Smithy', settlement: 'Phandalin', itemCount: 1 }];
    service.list.and.returnValue(of(summaries));
    component.ngOnChanges({ campaign: {} as any });
    expect(service.list).toHaveBeenCalledWith('1');
    expect(component.shops).toEqual(summaries);
    expect(component.selected).toBeNull();
  });

  it('createShop posts the name and selects the new shop', () => {
    service.create.and.returnValue(of(shop));
    component.newName = '  Smithy  ';
    component.createShop();
    expect(service.create).toHaveBeenCalledWith('1', 'Smithy', '');
    expect(component.selected).toBe(shop);
    expect(component.newName).toBe('');
  });

  it('createShop ignores a blank name', () => {
    component.newName = '   ';
    component.createShop();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('open loads the full shop', () => {
    service.get.and.returnValue(of(shop));
    component.open({ id: 5 } as ShopSummary);
    expect(service.get).toHaveBeenCalledWith(5);
    expect(component.selected).toBe(shop);
  });

  it('importCategory updates the selected shop', () => {
    component.selected = shop;
    const imported = { ...shop, items: [...shop.items, { ...shop.items[0], id: 10, catalogItemKey: 'dagger' }] };
    service.importCategory.and.returnValue(of(imported));
    component.importCategory('WEAPON');
    expect(service.importCategory).toHaveBeenCalledWith(5, 'WEAPON');
    expect(component.selected!.items.length).toBe(2);
  });

  it('setOverride converts gp to copper, and clears on empty', () => {
    component.selected = shop;
    service.updateItem.and.returnValue(of(shop));

    component.setOverride(shop.items[0], '12');
    expect(service.updateItem).toHaveBeenCalledWith(5, 9, 1200);

    component.setOverride(shop.items[0], '');
    expect(service.updateItem).toHaveBeenCalledWith(5, 9, null);
  });

  it('setOverride ignores non-numeric / negative input', () => {
    component.selected = shop;
    service.updateItem.and.returnValue(of(shop));
    component.setOverride(shop.items[0], 'abc');
    component.setOverride(shop.items[0], '-5');
    expect(service.updateItem).not.toHaveBeenCalled();
  });

  it('removeItem updates the selected shop', () => {
    component.selected = shop;
    const after = { ...shop, items: [] };
    service.removeItem.and.returnValue(of(after));
    component.removeItem(shop.items[0]);
    expect(service.removeItem).toHaveBeenCalledWith(5, 9);
    expect(component.selected!.items.length).toBe(0);
  });

  it('deleteShop clears selection and reloads', () => {
    component.selected = shop;
    service.delete.and.returnValue(of(void 0));
    component.deleteShop();
    expect(service.delete).toHaveBeenCalledWith(5);
    expect(component.selected).toBeNull();
    expect(service.list).toHaveBeenCalled(); // back() reloads
  });

  it('opens a shop from the keyboard through the name button, not a row role', () => {
    TestBed.resetTestingModule(); // beforeEach built the class without a DOM
    TestBed.configureTestingModule({
      imports: [CuratedShopsComponent],
      providers: [{ provide: CuratedShopService, useValue: service }],
    });
    service.list.and.returnValue(of([{ id: 5, campaignId: 1, name: 'Smithy', settlement: 'Phandalin', itemCount: 1 }]));
    service.get.and.returnValue(of(shop));
    const fixture = TestBed.createComponent(CuratedShopsComponent);
    fixture.componentInstance.campaign = campaign;
    fixture.componentInstance.ngOnChanges({ campaign: {} as any });
    fixture.detectChanges();

    const row: HTMLElement = fixture.nativeElement.querySelector('.shop-row');
    expect(row.getAttribute('role')).toBeNull(); // would nest the Copy JSON button
    const open: HTMLButtonElement = row.querySelector('button.shop-open')!;
    expect(open.textContent).toContain('Smithy');

    open.click();
    expect(service.get).toHaveBeenCalledTimes(1); // the row's own click did not fire again
    expect(fixture.componentInstance.selected).toBe(shop);
  });
});
