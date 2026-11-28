import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { DEMO_MODE_KEY } from '../../../environments/environment';
import { FollowerService } from './follower.service';
import { Follower } from '../models/follower';
import { PC } from '../models/pc';
import { isVestigeCompanion } from '../models/vestige-companion';

/** Companions in the follower service: the server's own, and demo mode's copy of its rules. */
describe('FollowerService (companions)', () => {
  let service: FollowerService;
  let httpMock: HttpTestingController;

  const warlock = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 5, playerName: 'Sam', prof: 3,
    stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 18 }, languages: ['Common'],
    subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' },
    ...over,
  });
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

  function setUp(demo: boolean): void {
    if (demo) localStorage.setItem(DEMO_MODE_KEY, 'true');
    else localStorage.removeItem(DEMO_MODE_KEY);
    TestBed.configureTestingModule({
      providers: [FollowerService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(FollowerService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(DEMO_MODE_KEY);
  });

  describe('demo mode', () => {
    beforeEach(() => setUp(true));

    const vestige = (): Follower => {
      const found = service.demoList(7).filter(isVestigeCompanion);
      expect(found.length).toBe(1);
      return found[0];
    };

    it('creates the vestige when its warlock has one, and says the followers changed', () => {
      const changed: number[] = [];
      service.changes$.subscribe(c => changed.push(c.pcId));

      service.demoSyncVestige(warlock());

      expect(vestige().name).toBe('Vestige');
      expect(vestige().kind).toBe('COMPANION');
      expect(vestige().statBlock.hp).toEqual({ max: 24, cur: 24, temp: 0 });
      expect(changed).toEqual([7]);
    });

    it('says nothing when nothing changed, and creates none for a character without one', () => {
      service.demoSyncVestige(warlock());
      const changed: number[] = [];
      service.changes$.subscribe(c => changed.push(c.pcId));

      service.demoSyncVestige(warlock());
      service.demoSyncVestige(warlock({ id: 8, subclass: 'Fiend Patron' }));
      service.demoSyncVestige(warlock({ id: 9, level: 2 }));

      expect(changed).toEqual([]);
      expect(service.demoList(8)).toEqual([]);
      expect(service.demoList(9)).toEqual([]);
    });

    it('rebuilds it beside the other followers and removes it with the subclass, touching nothing else', async () => {
      const brannoc = await run(service.grant(7, 'Brannoc', { ac: 16 }));
      const pip = await run(service.summon(7, 'Pip', { ac: 11 }, 'FAMILIAR'));
      service.demoSyncVestige(warlock());
      const made = vestige();

      service.demoSyncVestige(warlock({ level: 6 }));
      expect(vestige().id).toBe(made.id);
      expect(vestige().statBlock.hp).toEqual({ max: 28, cur: 28, temp: 0 });
      expect(service.demoList(7).map(f => f.name)).toEqual(['Brannoc', 'Pip', 'Vestige']);

      service.demoSyncVestige(warlock({ subclass: 'Fiend Patron' }));
      expect(service.demoList(7)).toEqual([brannoc, pip]);
    });

    it('takes only the name, the Hit Points and the conditions from an update', async () => {
      service.demoSyncVestige(warlock());
      const made = vestige();

      const updated = await run(service.update(7, made.id, 'Ashmaw', {
        ...made.statBlock, ac: 40, clazz: 'Dragon', hp: { max: 99, cur: 9, temp: 4 },
        conditions: ['poisoned', 'prone'], conditionImmunities: [],
      }));

      expect(updated.name).toBe('Ashmaw');
      expect(updated.kind).toBe('COMPANION');
      expect(updated.statBlock).toEqual({ ...made.statBlock, hp: { max: 24, cur: 9, temp: 4 }, conditions: ['poisoned'] });
      expect(vestige().statBlock.ac).toBe(17);
    });

    it('still replaces the whole block of any other follower', async () => {
      const brannoc = await run(service.grant(7, 'Brannoc', { ac: 16, clazz: 'Guard' }));
      const updated = await run(service.update(7, brannoc.id, 'Brannoc', { ac: 18 }));
      expect(updated.statBlock).toEqual({ ac: 18 });
    });

    it('refuses to dismiss it, to the owner and to the DM alike', async () => {
      service.demoSyncVestige(warlock());
      const made = vestige();
      const refused = {
        status: 403,
        message: 'A companion cannot be dismissed. It stays for as long as its character has the feature that gives it',
      };

      expect(await refusal(service.dismiss(7, made.id))).toEqual(refused);
      expect(await refusal(service.dismiss(7, made.id, true))).toEqual(refused);
      expect(vestige().id).toBe(made.id);
    });

    it('keeps a renamed, hurt vestige as it is across a rebuild', async () => {
      service.demoSyncVestige(warlock());
      const made = vestige();
      await run(service.update(7, made.id, 'Ashmaw', { ...made.statBlock, hp: { max: 24, cur: 9, temp: 0 } }));

      service.demoSyncVestige(warlock({ subclassChoices: { vestigeType: 'Undead', vestigeDomain: 'War' } }));

      expect(vestige().name).toBe('Ashmaw');
      expect(vestige().statBlock.race).toBe('Undead');
      expect(vestige().statBlock.hp).toEqual({ max: 24, cur: 9, temp: 0 });
    });
  });

  describe('against the server', () => {
    beforeEach(() => setUp(false));

    it('builds nothing itself: the server owns the companion', () => {
      const changed: number[] = [];
      service.changes$.subscribe(c => changed.push(c.pcId));

      service.demoSyncVestige(warlock());

      expect(service.demoList(7)).toEqual([]);
      expect(changed).toEqual([]);
    });

    it('sends an update of a companion like any other and shows what the server stored', () => {
      let saved: Follower | undefined;
      service.update(7, 3, 'Ashmaw', { ac: 40, hp: { max: 24, cur: 9, temp: 0 } }).subscribe(f => (saved = f));

      const req = httpMock.expectOne(r => r.url.endsWith('/api/v1/pc/7/followers/3'));
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 3, pcId: 7, name: 'Ashmaw', kind: 'COMPANION', statBlock: { ac: 17, hp: { max: 24, cur: 9, temp: 0 } } });
      expect(saved?.statBlock.ac).toBe(17);
    });
  });
});
