import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEMO_MODE_KEY, environment } from '../../../environments/environment';
import { FollowerService } from './follower.service';
import { Follower } from '../models/follower';

describe('FollowerService', () => {
  let service: FollowerService;
  let httpMock: HttpTestingController;
  const url = `${environment.characterApiUrl}/api/v1/pc/7/followers`;

  beforeEach(() => {
    localStorage.removeItem(DEMO_MODE_KEY);
    TestBed.configureTestingModule({
      providers: [FollowerService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(FollowerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(DEMO_MODE_KEY);
  });

  it('list GETs the character\'s followers', () => {
    let result: Follower[] | undefined;
    service.list(7).subscribe(f => (result = f));

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, pcId: 7, name: 'Brannoc', statBlock: { ac: 16 } }]);
    expect(result?.[0].name).toBe('Brannoc');
  });

  it('grant POSTs the name and stat block', () => {
    service.grant(7, 'Brannoc', { ac: 16 }).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Brannoc', statBlock: { ac: 16 } });
    req.flush({});
  });

  it('update PUTs to the follower with its name and stat block', () => {
    service.update(7, 3, 'Sir Brannoc', { ac: 18 }).subscribe();

    const req = httpMock.expectOne(`${url}/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Sir Brannoc', statBlock: { ac: 18 } });
    req.flush({});
  });

  it('dismiss DELETEs the follower', () => {
    service.dismiss(7, 3).subscribe();

    const req = httpMock.expectOne(`${url}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('grant, update and dismiss each announce the character on changes$, once the server answered', () => {
    const changed: number[] = [];
    service.changes$.subscribe(c => changed.push(c.pcId));

    service.grant(7, 'Brannoc', { ac: 16 }).subscribe();
    expect(changed).toEqual([]);
    httpMock.expectOne(url).flush({});
    service.update(7, 3, 'Brannoc', { ac: 18 }).subscribe();
    httpMock.expectOne(`${url}/3`).flush({});
    service.dismiss(7, 3).subscribe();
    httpMock.expectOne(`${url}/3`).flush(null);

    expect(changed).toEqual([7, 7, 7]);
  });

  it('a refused write announces nothing', () => {
    const changed: number[] = [];
    service.changes$.subscribe(c => changed.push(c.pcId));

    service.grant(7, 'Brannoc', { ac: 16 }).subscribe({ error: () => {} });
    httpMock.expectOne(url).flush('no', { status: 403, statusText: 'Forbidden' });

    expect(changed).toEqual([]);
  });

  describe('demo mode', () => {
    beforeEach(() => localStorage.setItem(DEMO_MODE_KEY, 'true'));

    it('keeps followers in memory per character, with no HTTP calls', (done) => {
      service.grant(7, ' Brannoc ', { ac: 16 }).subscribe(granted => {
        expect(granted.name).toBe('Brannoc');
        service.update(7, granted.id, 'Brannoc', { ac: 18 }).subscribe(() => {
          service.list(7).subscribe(mine => {
            expect(mine.map(f => f.statBlock.ac)).toEqual([18]);
            service.list(8).subscribe(theirs => {
              expect(theirs).toEqual([]); // another character sees none of them
              service.dismiss(7, granted.id).subscribe(() => {
                service.list(7).subscribe(after => {
                  expect(after).toEqual([]);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });
});
