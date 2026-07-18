import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { CuratedEncounterService } from './curated-encounter.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('CuratedEncounterService', () => {
  let service: CuratedEncounterService;
  let httpMock: HttpTestingController;
  const base = `${environment.characterApiUrl}/api/v1`;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [CuratedEncounterService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(CuratedEncounterService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list GETs the campaign encounters', () => {
    service.list(1).subscribe();
    const req = httpMock.expectOne(`${base}/campaign/1/encounters`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create POSTs the name and notes', () => {
    service.create(1, 'Goblin Ambush', 'In the trees.').subscribe();
    const req = httpMock.expectOne(`${base}/campaign/1/encounters`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Goblin Ambush', notes: 'In the trees.' });
    req.flush({});
  });

  it('addCreature POSTs the creature fields (armorClass, not dex)', () => {
    service.addCreature(5, 'Goblin', 15, 7, 4).subscribe();
    const req = httpMock.expectOne(`${base}/encounters/5/creatures`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Goblin', armorClass: 15, hpMax: 7, quantity: 4 });
    req.flush({});
  });

  it('addCreature allows an unknown AC (null)', () => {
    service.addCreature(5, 'Mysterious Figure', null, null, 1).subscribe();
    const req = httpMock.expectOne(`${base}/encounters/5/creatures`);
    expect(req.request.body).toEqual({ name: 'Mysterious Figure', armorClass: null, hpMax: null, quantity: 1 });
    req.flush({});
  });

  it('removeCreature DELETEs the line', () => {
    service.removeCreature(5, 9).subscribe();
    const req = httpMock.expectOne(`${base}/encounters/5/creatures/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('delete DELETEs the encounter', () => {
    service.delete(5).subscribe();
    const req = httpMock.expectOne(`${base}/encounters/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

});
