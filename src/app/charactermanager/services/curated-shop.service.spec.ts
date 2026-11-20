import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CuratedShopService, toAddShopItemRequest } from './curated-shop.service';
import { CatalogItem } from '../models/shop';
import { environment } from '../../../environments/environment';

describe('CuratedShopService', () => {
  let service: CuratedShopService;
  let httpMock: HttpTestingController;
  const base = `${environment.characterApiUrl}/api/v1`;

  const longsword: CatalogItem = {
    itemKey: 'longsword', name: 'Longsword', category: 'WEAPON', costCp: 1500, bulk: 2, details: {},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CuratedShopService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('addItem POSTs a catalog pick as a key with no price override', () => {
    service.addItem(5, { kind: 'catalog', item: longsword, qty: 3 }).subscribe();
    const req = httpMock.expectOne(`${base}/shops/5/items`);
    expect(req.request.method).toBe('POST');
    // No quantity: a shop has unlimited stock.
    expect(req.request.body).toEqual({ catalogItemKey: 'longsword', priceCp: null });
    req.flush({});
  });

  it('addItem POSTs a custom item with its stats, its value as the price in copper', () => {
    service.addItem(5, {
      kind: 'custom', name: 'Flametongue', category: 'weapon', qty: 1, valueGp: 5000, weight: 3, bulk: 2,
      damage: '1d8 slashing + 2d6 fire', notes: 'Requires: attunement.',
    }).subscribe();
    const req = httpMock.expectOne(`${base}/shops/5/items`);
    expect(req.request.body).toEqual({
      customName: 'Flametongue', priceCp: 500000, category: 'weapon', customNotes: 'Requires: attunement.',
      weight: 3, bulk: 2, damage: '1d8 slashing + 2d6 fire',
    });
    req.flush({});
  });
});

describe('toAddShopItemRequest', () => {
  it('leaves the price for the server to default when a custom item has no value', () => {
    expect(toAddShopItemRequest({ kind: 'custom', name: 'Lucky Coin', category: 'gear', qty: 1 }))
      .toEqual({ customName: 'Lucky Coin', priceCp: null, category: 'gear' });
  });

  it('rounds a fractional gold price to whole copper', () => {
    expect(toAddShopItemRequest({ kind: 'custom', name: 'Candle', category: 'gear', qty: 1, valueGp: 0.015 })
      .priceCp).toBe(2);
  });
});
