import { of, throwError } from 'rxjs';
import { CatalogItem } from '../models/shop';
import { CatalogLookupService } from './catalog-lookup.service';
import { ShopService } from './shop.service';

describe('CatalogLookupService', () => {
  let shopService: jasmine.SpyObj<ShopService>;
  let service: CatalogLookupService;

  const item = (itemKey: string, category: string): CatalogItem =>
    ({ itemKey, name: itemKey, category, costCp: 100, bulk: 1, details: {} });

  beforeEach(() => {
    shopService = jasmine.createSpyObj<ShopService>('ShopService', ['getCatalog']);
    shopService.getCatalog.and.callFake((category: string) =>
      of(category === 'WEAPON' ? [item('longsword', 'WEAPON')]
        : category === 'GEAR' ? [item('rations', 'GEAR'), item('torch', 'GEAR')] : []));
    service = new CatalogLookupService(shopService);
  });

  it('joins every category into one list', () => {
    let all: CatalogItem[] = [];
    service.all().subscribe(items => (all = items));
    expect(shopService.getCatalog.calls.allArgs().map(a => a[0]))
      .toEqual(['WEAPON', 'ARMOR', 'MATERIAL_COMPONENT', 'GEAR', 'TRANSPORT']);
    expect(all.map(i => i.itemKey)).toEqual(['longsword', 'rations', 'torch']);
  });

  it('loads the catalog once and reuses it', () => {
    service.all().subscribe();
    service.all().subscribe();
    expect(shopService.getCatalog).toHaveBeenCalledTimes(5);
  });

  it('forgets a failed load so the next caller tries again', () => {
    shopService.getCatalog.and.returnValue(throwError(() => new Error('network down')));
    let failed = false;
    service.all().subscribe({ error: () => (failed = true) });
    expect(failed).toBeTrue();

    shopService.getCatalog.and.returnValue(of([item('longsword', 'WEAPON')]));
    let count = 0;
    service.all().subscribe(items => (count = items.length));
    expect(count).toBe(5); // one per category from the stub
  });
});
