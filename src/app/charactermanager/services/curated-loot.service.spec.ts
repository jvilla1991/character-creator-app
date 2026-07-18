import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { CuratedLootService, toAddLootItemRequest } from './curated-loot.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { CatalogItem } from '../models/shop';

describe('CuratedLootService', () => {
  let service: CuratedLootService;
  let httpMock: HttpTestingController;
  const base = `${environment.characterApiUrl}/api/v1`;

  const longsword: CatalogItem = {
    itemKey: 'longsword', name: 'Longsword', category: 'WEAPON',
    costCp: 1500, weight: 3, bulk: 2, details: {},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [CuratedLootService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(CuratedLootService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list GETs the campaign loot lists', () => {
    service.list(1).subscribe();
    const req = httpMock.expectOne(`${base}/campaign/1/loot`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create POSTs the name and notes', () => {
    service.create(1, 'Goblin Ambush spoils', null).subscribe();
    const req = httpMock.expectOne(`${base}/campaign/1/loot`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Goblin Ambush spoils', notes: null });
    req.flush({});
  });

  it('addItem maps a catalog authored item onto the wire shape', () => {
    service.addItem(5, { kind: 'catalog', item: longsword, qty: 2 }).subscribe();
    const req = httpMock.expectOne(`${base}/curated-loot/5/items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      { catalogItemKey: 'longsword', customName: null, customNotes: null, qty: 2 });
    req.flush({});
  });

  it('addItem maps a custom authored item with the full attribute set', () => {
    service.addItem(5, {
      kind: 'custom', name: 'Flametongue', category: 'weapon', qty: 1,
      valueGp: 50, weight: 3, damage: '1d8 slashing + 2d6 fire', notes: 'Ignites.',
    }).subscribe();
    const req = httpMock.expectOne(`${base}/curated-loot/5/items`);
    expect(req.request.body).toEqual({
      catalogItemKey: null, customName: 'Flametongue', customNotes: 'Ignites.', qty: 1,
      category: 'weapon', valueGp: 50, weight: 3, damage: '1d8 slashing + 2d6 fire',
    });
    req.flush({});
  });

  it('setCoins PUTs the gp amount', () => {
    service.setCoins(5, 125.5).subscribe();
    const req = httpMock.expectOne(`${base}/curated-loot/5/coins`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ coinGp: 125.5 });
    req.flush({});
  });

  it('importLoot POSTs the payload verbatim', () => {
    const payload = { coinGp: 10, items: [{ key: 'longsword', name: null, notes: null, qty: null }] };
    service.importLoot(5, payload).subscribe();
    const req = httpMock.expectOne(`${base}/curated-loot/5/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('delete DELETEs the list', () => {
    service.delete(5).subscribe();
    const req = httpMock.expectOne(`${base}/curated-loot/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});

describe('toAddLootItemRequest', () => {
  it('omits absent optional attributes on a custom line (legacy-shaped wire body)', () => {
    expect(toAddLootItemRequest({ kind: 'custom', name: 'Old Boot', category: 'gear', qty: 1 }))
      .toEqual({ catalogItemKey: null, customName: 'Old Boot', customNotes: null, qty: 1, category: 'gear' });
  });

  it('carries armorClass for custom armor', () => {
    expect(toAddLootItemRequest({
      kind: 'custom', name: 'Mithral Plate', category: 'armor', qty: 1, armorClass: '18',
    })).toEqual({
      catalogItemKey: null, customName: 'Mithral Plate', customNotes: null, qty: 1,
      category: 'armor', armorClass: '18',
    });
  });
});
