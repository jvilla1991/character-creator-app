import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
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

  it('summon POSTs the name, the stat block and the kind', () => {
    let created: Follower | undefined;
    service.summon(7, 'Pip', { ac: 11 }, 'FAMILIAR').subscribe(f => (created = f));

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Pip', statBlock: { ac: 11 }, kind: 'FAMILIAR' });
    req.flush({ id: 4, pcId: 7, name: 'Pip', statBlock: { ac: 11 }, kind: 'FAMILIAR' });
    expect(created?.kind).toBe('FAMILIAR');

    service.summon(7, 'Thorn', { ac: 16 }, 'SUMMON').subscribe();
    expect(httpMock.expectOne(url).request.body.kind).toBe('SUMMON');
  });

  it('summon announces the character on changes$, and a refused one announces nothing', () => {
    const changed: number[] = [];
    service.changes$.subscribe(c => changed.push(c.pcId));

    service.summon(7, 'Thorn', { ac: 16 }, 'SUMMON').subscribe();
    httpMock.expectOne(url).flush({});
    service.summon(7, 'Thorn', { ac: 16 }, 'SUMMON').subscribe({ error: () => {} });
    httpMock.expectOne(url).flush({ message: 'full' }, { status: 409, statusText: 'Conflict' });

    expect(changed).toEqual([7]);
  });

  it('dismiss sends the same request whoever asks: the server decides', () => {
    service.dismiss(7, 3, true).subscribe();

    const req = httpMock.expectOne(`${url}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
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
              service.dismiss(7, granted.id, true).subscribe(() => {
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

    // The demo has no server, so it applies the server's rules itself.
    const run = <T>(source: Observable<T>): Promise<T> => firstValueFrom(source);
    const refusal = async (source: Observable<unknown>): Promise<{ status: number; message: string }> => {
      try {
        await run(source);
      } catch (e) {
        const err = e as { status: number; error: { message: string } };
        return { status: err.status, message: err.error.message };
      }
      throw new Error('expected a refusal');
    };

    it('stamps each follower with its kind: a grant, a summon, a familiar', async () => {
      await run(service.grant(7, 'Brannoc', { ac: 16 }));
      await run(service.summon(7, 'Thorn', { ac: 16 }, 'SUMMON'));
      await run(service.summon(7, 'Pip', { ac: 11 }, 'FAMILIAR'));

      expect((await run(service.list(7))).map(f => [f.name, f.kind]))
        .toEqual([['Brannoc', 'DM_GRANT'], ['Thorn', 'SUMMON'], ['Pip', 'FAMILIAR']]);
    });

    it('a new familiar replaces the current one and leaves every other follower alone', async () => {
      await run(service.grant(7, 'Brannoc', { ac: 16 }));
      await run(service.summon(7, 'Pip', { ac: 11 }, 'FAMILIAR'));
      await run(service.summon(7, 'Thorn', { ac: 16 }, 'SUMMON'));
      await run(service.summon(8, 'Other', { ac: 11 }, 'FAMILIAR')); // another character's familiar

      const next = await run(service.summon(7, 'Soot', { ac: 12 }, 'FAMILIAR'));

      expect((await run(service.list(7))).map(f => f.name)).toEqual(['Brannoc', 'Thorn', 'Soot']);
      expect(next.kind).toBe('FAMILIAR');
      expect((await run(service.list(8))).map(f => f.name)).toEqual(['Other']);
    });

    it('gives two followers made in the same instant different ids', async () => {
      const [a, b] = await Promise.all([
        run(service.summon(7, 'One', {}, 'SUMMON')),
        run(service.summon(7, 'Two', {}, 'SUMMON')),
      ]);

      expect(a.id).not.toBe(b.id);
    });

    it('caps a character at twenty followers of every kind, but a replaced familiar does not count', async () => {
      await run(service.summon(7, 'Pip', {}, 'FAMILIAR'));
      for (let i = 0; i < 10; i++) await run(service.grant(7, 'Guard ' + i, {}));
      for (let i = 0; i < 9; i++) await run(service.summon(7, 'Spirit ' + i, {}, 'SUMMON'));
      expect((await run(service.list(7))).length).toBe(20);

      const full = { status: 409, message: 'A character can have at most 20 followers' };
      expect(await refusal(service.summon(7, 'One more', {}, 'SUMMON'))).toEqual(full);
      expect(await refusal(service.grant(7, 'One more', {}))).toEqual(full);

      // The twenty include the familiar this one replaces.
      const soot = await run(service.summon(7, 'Soot', {}, 'FAMILIAR'));
      const after = await run(service.list(7));
      expect(after.length).toBe(20);
      expect(after.map(f => f.name)).toContain('Soot');
      expect(after.map(f => f.name)).not.toContain('Pip');
      expect(soot.kind).toBe('FAMILIAR');
    });

    it('lets the owner dismiss their own summon and familiar, but not a DM grant', async () => {
      const brannoc = await run(service.grant(7, 'Brannoc', {}));
      const thorn = await run(service.summon(7, 'Thorn', {}, 'SUMMON'));
      const pip = await run(service.summon(7, 'Pip', {}, 'FAMILIAR'));

      expect(await refusal(service.dismiss(7, brannoc.id))).toEqual({ status: 403, message: 'Access denied' });
      await run(service.dismiss(7, thorn.id));
      await run(service.dismiss(7, pip.id));

      expect((await run(service.list(7))).map(f => f.name)).toEqual(['Brannoc']);
    });

    it('lets the DM dismiss every kind, and refuses a follower that is not there', async () => {
      const brannoc = await run(service.grant(7, 'Brannoc', {}));
      const thorn = await run(service.summon(7, 'Thorn', {}, 'SUMMON'));

      await run(service.dismiss(7, brannoc.id, true));
      await run(service.dismiss(7, thorn.id, true));

      expect(await run(service.list(7))).toEqual([]);
      expect((await refusal(service.dismiss(7, 999, true))).status).toBe(404);
    });

    it('a refused create or dismissal announces nothing', async () => {
      const brannoc = await run(service.grant(7, 'Brannoc', {}));
      const changed: number[] = [];
      service.changes$.subscribe(c => changed.push(c.pcId));

      await refusal(service.dismiss(7, brannoc.id));

      expect(changed).toEqual([]);
    });
  });
});
