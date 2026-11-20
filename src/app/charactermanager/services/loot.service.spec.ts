import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { LootImportPayload } from '../models/loot';
import { LootService } from './loot.service';

describe('LootService', () => {
  let service: LootService;
  let httpMock: HttpTestingController;
  const base = `${environment.characterApiUrl}/api/v1/session`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LootService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('open seeds the pool from a curated loot list', () => {
    service.open(1, 5, null).subscribe();
    const req = httpMock.expectOne(`${base}/1/loot`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ lootId: 5, name: null });
    req.flush({});
  });

  it('open from scratch sends neither a list nor contents', () => {
    service.open(1, null, 'Bandit spoils').subscribe();
    const req = httpMock.expectOne(`${base}/1/loot`);
    expect(req.request.body).toEqual({ lootId: null, name: 'Bandit spoils' });
    req.flush({});
  });

  it('open from pasted JSON sends the lines and coins as the pool\'s contents', () => {
    const contents: LootImportPayload = {
      coinGp: 125.5,
      items: [
        { key: 'longsword', name: null, notes: null, qty: 2 },
        { key: null, name: 'Flametongue', notes: 'Requires: attunement.', qty: null,
          category: 'weapon', valueGp: 5000, weight: 3, bulk: 2, damage: '1d8 slashing + 2d6 fire' },
      ],
    };
    service.open(1, null, 'Vault spoils', contents).subscribe();
    const req = httpMock.expectOne(`${base}/1/loot`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ lootId: null, name: 'Vault spoils', contents });
    req.flush({});
  });
});
