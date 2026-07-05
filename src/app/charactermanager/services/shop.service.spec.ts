import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ShopService } from './shop.service';
import { costToCoins, formatCp } from '../models/shop';

describe('ShopService', () => {
  let service: ShopService;
  let httpMock: HttpTestingController;
  const base = `${environment.characterApiUrl}/api/v1/session`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ShopService],
    });
    service = TestBed.inject(ShopService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('openShop POSTs category, settlement and targets', () => {
    service.openShop(1, 'WEAPON', 'Phandalin', [7, 8]).subscribe();
    const req = httpMock.expectOne(`${base}/1/shop`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ category: 'WEAPON', settlement: 'Phandalin', pcIds: [7, 8] });
    req.flush({});
  });

  it('getCatalog GETs the catalog by category', () => {
    const catalogUrl = `${environment.characterApiUrl}/api/v1/catalog`;
    service.getCatalog('WEAPON').subscribe();
    const req = httpMock.expectOne(`${catalogUrl}?category=WEAPON`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('setAttendees PUTs the pcIds', () => {
    service.setAttendees(1, [7]).subscribe();
    const req = httpMock.expectOne(`${base}/1/shop/attendees`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ pcIds: [7] });
    req.flush({});
  });

  it('closeShop DELETEs the shop', () => {
    service.closeShop(1).subscribe();
    const req = httpMock.expectOne(`${base}/1/shop`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getShop GETs the active shop', () => {
    let result: unknown;
    service.getShop(1).subscribe(r => (result = r));
    const req = httpMock.expectOne(`${base}/1/shop`);
    expect(req.request.method).toBe('GET');
    req.flush({ shopId: 10, category: 'WEAPON', items: [] });
    expect((result as any).shopId).toBe(10);
  });

  it('purchase POSTs pcId, itemKey and qty', () => {
    service.purchase(1, 7, 'longsword', 2).subscribe();
    const req = httpMock.expectOne(`${base}/1/shop/purchase`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pcId: 7, itemKey: 'longsword', qty: 2 });
    req.flush({ coins: {}, inventory: [], totalCostCp: 3000 });
  });

  describe('cost helpers', () => {
    it('costToCoins splits copper into gp/sp/cp', () => {
      expect(costToCoins(1500)).toEqual({ gp: 15, sp: 0, cp: 0 });
      expect(costToCoins(110)).toEqual({ gp: 1, sp: 1, cp: 0 });
      expect(costToCoins(5)).toEqual({ gp: 0, sp: 0, cp: 5 });
    });

    it('formatCp renders a compact label', () => {
      expect(formatCp(1500)).toBe('15 gp');
      expect(formatCp(110)).toBe('1 gp 1 sp');
      expect(formatCp(5)).toBe('5 cp');
      expect(formatCp(0)).toBe('0 cp');
    });
  });
});
