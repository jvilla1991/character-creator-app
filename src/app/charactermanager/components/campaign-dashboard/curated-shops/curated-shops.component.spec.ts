import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ConfirmService } from '../../modal/confirm.service';
import { CuratedShopsComponent } from './curated-shops.component';
import { Campaign } from '../../../models/campaign';
import { CuratedShop, ShopImportPayload, ShopSummary } from '../../../models/curated-shop';
import { JsonImportConfirmed } from '../../json-import/json-import.component';
import { CuratedShopService } from '../../../services/curated-shop.service';
import { NotificationService } from '../../../services/notification.service';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CuratedShopsComponent', () => {
  let confirm: jasmine.Spy;
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
      ['list', 'create', 'get', 'update', 'delete', 'addItem', 'updateItem', 'removeItem', 'importCategory',
       'importShop']);
    service.list.and.returnValue(of([] as ShopSummary[]));
    component = TestBed.runInInjectionContext(() => new CuratedShopsComponent(service));
    component.campaign = campaign;
    confirm = spyOn(TestBed.inject(ConfirmService), 'confirm').and.returnValue(of(undefined));
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

  // The import box checks the paste and hands over a normalized payload; this
  // component only sends it and reports what the server says.
  const confirmedShop = (payload: ShopImportPayload | null): JsonImportConfirmed =>
    ({ loot: null, shop: payload, catalog: new Map() });

  it('importShop sends nothing without a checked payload', () => {
    component.importShop(confirmedShop(null));
    expect(service.importShop).not.toHaveBeenCalled();
  });

  it('importShop posts the checked payload, opens the new shop and closes the import box', () => {
    component.importOpen = true;
    const payload: ShopImportPayload = {
      name: 'Smithy', settlement: 'Phandalin', items: [{ key: 'longsword', priceGp: 12 }] };
    service.importShop.and.returnValue(of(shop));
    component.importShop(confirmedShop(payload));
    expect(service.importShop).toHaveBeenCalledWith('1', payload);
    expect(component.selected).toBe(shop);
    expect(component.importOpen).toBeFalse();
  });

  it('importShop surfaces the server message on failure and keeps the box open', () => {
    component.importOpen = true;
    service.importShop.and.returnValue(
      throwError(() => ({ error: { message: 'Unknown catalog keys: vorpal-blade' } })));
    component.importShop(confirmedShop({ name: 'Smithy', items: [{ key: 'vorpal-blade' }] }));
    expect(component.importError).toBe('Unknown catalog keys: vorpal-blade');
    expect(component.importOpen).toBeTrue();
    expect(component.busy).toBeFalse();
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

  it('a failed price save puts the field back to the saved override and says so', () => {
    const notify = spyOn(TestBed.inject(NotificationService), 'error');
    component.selected = shop;
    const field = document.createElement('input');
    field.value = '99';
    service.updateItem.and.returnValue(throwError(() => new Error('down')));
    component.setOverride(shop.items[0], '99', field);
    expect(field.value).toBe('');
    expect(notify).toHaveBeenCalled();
  });

  it('setOverride ignores non-numeric / negative input', () => {
    component.selected = shop;
    service.updateItem.and.returnValue(of(shop));
    component.setOverride(shop.items[0], 'abc');
    component.setOverride(shop.items[0], '-5');
    expect(service.updateItem).not.toHaveBeenCalled();
  });

  // --- custom (non-catalog) lines ---

  const customLine: CuratedShop['items'][number] = {
    id: 12, catalogItemKey: null, name: 'Flametongue', category: 'WEAPON', custom: true,
    priceOverrideCp: 500000, effectiveCostCp: 500000, weight: 3, bulk: 2,
    notes: 'Requires: attunement.', details: { damage: '1d8 slashing + 2d6 fire' },
  };

  it('onItemAuthored adds the composed line and shows the updated shop', () => {
    component.selected = shop;
    const after = { ...shop, items: [...shop.items, customLine] };
    service.addItem.and.returnValue(of(after));
    const authored = { kind: 'custom' as const, name: 'Flametongue', category: 'weapon' as const, qty: 1, valueGp: 5000 };

    component.onItemAuthored(authored);

    expect(service.addItem).toHaveBeenCalledWith(5, authored);
    expect(component.selected).toBe(after);
    expect(component.busy).toBeFalse();
  });

  it('onItemAuthored says so when a catalog item is already in the shop', () => {
    component.selected = shop;
    const error = { status: 409 };
    service.addItem.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');

    component.onItemAuthored({ kind: 'custom', name: 'X', category: 'gear', qty: 1 });

    expect(notify).toHaveBeenCalledWith('That item is already in this shop.', error);
    expect(component.busy).toBeFalse();
  });

  it('itemMeta shows a custom line by its own stats, a catalog line by its category', () => {
    expect(component.itemMeta(customLine)).toBe('weapon · 1d8 slashing + 2d6 fire · 3 lb · 2 bulk · custom');
    expect(component.itemMeta(shop.items[0])).toBe('weapon');
  });

  it('a custom line keeps a price: an emptied field is put back, not sent', () => {
    component.selected = shop;
    const notify = spyOn(TestBed.inject(NotificationService), 'notify');
    const field = { value: '' } as HTMLInputElement;

    component.setOverride(customLine, '', field);

    expect(service.updateItem).not.toHaveBeenCalled();
    expect(field.value).toBe('5000');
    expect(notify).toHaveBeenCalled();

    service.updateItem.and.returnValue(of(shop));
    component.setOverride(customLine, '4500', field);
    expect(service.updateItem).toHaveBeenCalledWith(5, 12, 450000);
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

  it('deleteShop() asks first and does nothing when the DM cancels', () => {
    confirm.and.returnValue(of());
    component.selected = shop;
    component.deleteShop();
    expect(confirm).toHaveBeenCalledWith(jasmine.objectContaining({ confirmLabel: jasmine.any(String) }));
    expect(service.delete).not.toHaveBeenCalled();
  });
});
