import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { DEMO_MODE_KEY } from 'src/environments/environment';

import { PCService } from './pc.service';
import { FollowerService } from './follower.service';
import { Follower } from '../models/follower';
import { PC, PcSpell } from '../models/pc';
import { isVestigeCompanion } from '../models/vestige-companion';

/**
 * The demo mirror of a Vestige Patron: its level-up asks for the type and the
 * domain the way the server does, and its Vestige Spells are named in the
 * preview. Each test adds its own character to the demo store.
 */
describe('PCService Vestige Patron (demo mode)', () => {
  let service: PCService;
  const ID = 901;

  beforeEach(() => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    TestBed.configureTestingModule({
      providers: [PCService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(PCService);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify(); // demo mode never calls the server
    localStorage.removeItem(DEMO_MODE_KEY);
  });

  function seed(over: Partial<PC> = {}): PC {
    const pc: PC = {
      id: ID, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 2, playerName: 'Sam',
      campaignId: null, prof: 2, hp: { max: 17, cur: 17, temp: 0 },
      stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 16 },
      languages: ['Common', 'Infernal'], spells: [], skills: {}, features: [],
      ...over,
    };
    const store = service as unknown as { pcs: PC[] };
    store.pcs = [...store.pcs.filter(p => p.id !== ID), pc];
    return pc;
  }
  const granted = (name: string, lvl: number): PcSpell =>
    ({ name, lvl, school: 'evocation', time: 'action', prepared: true, alwaysPrepared: true, grantedBy: 'Vestige Spells' });
  const refusal = (call: Promise<unknown>): Promise<HttpErrorResponse> =>
    call.then(() => { throw new Error('expected a refusal'); }, (err: HttpErrorResponse) => err);
  const names = (grants: { name: string }[] | undefined) => (grants ?? []).map(g => g.name);

  describe('level-up', () => {
    it('refuses to reach Warlock 3 without the type and the domain', async () => {
      seed();
      expect((await refusal(firstValueFrom(service.levelUp(ID)))).error.message)
        .toBe('A Vestige Patron must choose a Vestige type');
      expect((await refusal(firstValueFrom(service.levelUp(ID, { subclassChoices: { vestigeType: 'Fiend' } })))).error.message)
        .toBe('A Vestige Patron must choose a Vestige domain');
      expect(service.getPCById(ID)!.level).toBe(2);

      const updated = await firstValueFrom(
        service.levelUp(ID, { subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' } }));
      expect(updated.level).toBe(3);
      expect(updated.subclassChoices).toEqual({ vestigeType: 'Fiend', vestigeDomain: 'War' });
    });

    it('asks nothing below Warlock 3, of another patron, or once both are stored', async () => {
      seed({ level: 1 });
      expect((await firstValueFrom(service.levelUp(ID))).level).toBe(2);

      seed({ subclass: 'Fiend Patron' });
      expect((await firstValueFrom(service.levelUp(ID))).level).toBe(3);

      seed({ level: 4, subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' } });
      expect((await firstValueFrom(service.levelUp(ID))).level).toBe(5);
    });

    it('still asks a later level-up for the one that is missing', async () => {
      seed({ level: 6, subclassChoices: { vestigeType: 'Fiend' } });
      expect((await refusal(firstValueFrom(service.levelUp(ID)))).error.message)
        .toBe('A Vestige Patron must choose a Vestige domain');
      const updated = await firstValueFrom(service.levelUp(ID, { subclassChoices: { vestigeDomain: 'Life' } }));
      expect(updated.subclassChoices).toEqual({ vestigeType: 'Fiend', vestigeDomain: 'Life' });
    });

    it('saves the Vestige Spells sent with it', async () => {
      seed();
      const spells = [granted('Guiding Bolt', 1), granted('Magic Weapon', 2)];
      const updated = await firstValueFrom(service.levelUp(ID,
        { subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' }, newSpells: spells }));
      expect(updated.spells!.map(s => [s.name, s.alwaysPrepared, s.grantedBy]))
        .toEqual([['Guiding Bolt', true, 'Vestige Spells'], ['Magic Weapon', true, 'Vestige Spells']]);
    });
  });

  describe('level-up preview', () => {
    it('lists what each domain would hand over while none is chosen', async () => {
      seed();
      const preview = await firstValueFrom(service.levelUpPreview(ID));
      expect(Object.keys(preview.alwaysPreparedSpellsByVestigeDomain ?? {})).toEqual(['Life', 'Light', 'Trickery', 'War']);
      expect(names(preview.alwaysPreparedSpellsByVestigeDomain!['War']))
        .toEqual(['Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon']);
      expect(preview.alwaysPreparedSpellsByVestigeDomain!['War'].every(g => g.grantedBy === 'Vestige Spells')).toBeTrue();
      expect(preview.alwaysPreparedSpells).toEqual([]);
    });

    it('puts the stored domain\'s owed spells in the ordinary list, less the ones already held', async () => {
      seed({
        level: 4, subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' },
        spells: [granted('Guiding Bolt', 1), granted('Magic Weapon', 2), granted('Shield of Faith', 1),
          granted('Spiritual Weapon', 2)],
      });
      const preview = await firstValueFrom(service.levelUpPreview(ID));
      expect(names(preview.alwaysPreparedSpells)).toEqual(["Crusader's Mantle", 'Spirit Guardians']);
      expect(preview.alwaysPreparedSpellsByVestigeDomain).toEqual({});
    });

    it('lists no domain below Warlock 3 or for another patron', async () => {
      seed({ level: 1 });
      expect((await firstValueFrom(service.levelUpPreview(ID))).alwaysPreparedSpellsByVestigeDomain).toEqual({});
      seed({ subclass: 'Fiend Patron', level: 5 });
      const preview = await firstValueFrom(service.levelUpPreviewAsDm(ID));
      expect(preview.alwaysPreparedSpellsByVestigeDomain).toEqual({});
      expect(preview.alwaysPreparedSpells).toEqual([]);
    });
  });

  // The server's companion step, run by the demo store after the same writes.
  describe('the companion', () => {
    const followers = (): Follower[] => TestBed.inject(FollowerService).demoList(ID);
    const vestige = (): Follower => {
      const found = followers().filter(isVestigeCompanion);
      expect(found.length).toBe(1);
      return found[0];
    };
    const FIEND_WAR = { vestigeType: 'Fiend' as const, vestigeDomain: 'War' as const };
    const play = (name: string, cur: number) => firstValueFrom(TestBed.inject(FollowerService)
      .update(ID, vestige().id, name, { ...vestige().statBlock, hp: { ...vestige().statBlock.hp!, cur } }));

    it('appears when the level-up to Warlock 3 chooses its type', async () => {
      seed();
      expect(followers()).toEqual([]);
      await firstValueFrom(service.levelUp(ID, { subclassChoices: FIEND_WAR }));

      expect(vestige().name).toBe('Vestige');
      expect(vestige().statBlock.race).toBe('Fiend');
      expect(vestige().statBlock.level).toBe(3);
      expect(vestige().statBlock.hp).toEqual({ max: 16, cur: 16, temp: 0 });
      expect(vestige().statBlock.ac).toBe(16);
      expect(vestige().statBlock.languages).toEqual(['Common', 'Infernal']);
    });

    it('does not appear below Warlock 3', async () => {
      seed({ level: 1 });
      await firstValueFrom(service.levelUp(ID));
      expect(followers()).toEqual([]);
    });

    it('is rebuilt by a level-up, as the DM too, and gains the new Hit Points at once', async () => {
      seed({ level: 4, subclassChoices: FIEND_WAR });
      await firstValueFrom(service.updatePC(service.getPCById(ID)!));      // an existing patron's first save makes it
      await play('Ashmaw', 6);                                             // 6 of 20

      await firstValueFrom(service.levelUpAsDm(ID));                       // Warlock 5: 24, +3

      expect(vestige().name).toBe('Ashmaw');
      expect(vestige().statBlock.hp).toEqual({ max: 24, cur: 10, temp: 0 });
      expect(vestige().statBlock.prof).toBe(3);
    });

    it('is rebuilt by a sheet save that changes Charisma, the owner\'s or the DM\'s', async () => {
      const pc = seed({ level: 5, prof: 3, subclassChoices: FIEND_WAR });
      await firstValueFrom(service.updatePC(pc));
      expect(vestige().statBlock.ac).toBe(16);
      await play('Ashmaw', 9);

      await firstValueFrom(service.updatePC({ ...pc, stats: { ...pc.stats!, CHA: 20 } }));
      expect(vestige().statBlock.ac).toBe(18);
      expect(vestige().statBlock.hp).toEqual({ max: 24, cur: 9, temp: 0 });

      await firstValueFrom(service.updatePCAsDm({ ...pc, stats: { ...pc.stats!, CHA: 8 } }, 'Cursed'));
      expect(vestige().statBlock.ac).toBe(12);
      expect(vestige().name).toBe('Ashmaw');
    });

    it('is left alone by a save that changes nothing it is built from', async () => {
      const pc = seed({ level: 5, subclassChoices: FIEND_WAR });
      await firstValueFrom(service.updatePC(pc));
      const before = vestige();
      const changed: number[] = [];
      TestBed.inject(FollowerService).changes$.subscribe(c => changed.push(c.pcId));

      await firstValueFrom(service.updatePC({ ...pc, bio: 'Bound at the Hollow Ford.', hp: { max: 17, cur: 3, temp: 0 } }));

      expect(vestige()).toBe(before);
      expect(changed).toEqual([]);
    });

    it('takes a new type from the subclass-choices write and keeps its name and Hit Points', async () => {
      seed({ level: 5, subclassChoices: FIEND_WAR, campaignId: 'veiled' });
      await firstValueFrom(service.updatePC(service.getPCById(ID)!));
      await play('Ashmaw', 9);

      await firstValueFrom(service.setSubclassChoices(ID, { vestigeType: 'Undead' }));
      expect(vestige().statBlock.race).toBe('Undead');
      expect(vestige().statBlock.hp).toEqual({ max: 24, cur: 9, temp: 0 });

      await firstValueFrom(service.setSubclassChoices(ID, { vestigeType: 'Celestial' }, true));
      expect(vestige().statBlock.race).toBe('Celestial');
      expect(vestige().name).toBe('Ashmaw');
    });

    it('appears when a subclass set by hand gets its type on the sheet', async () => {
      seed({ level: 7 });                                                  // no type, no domain, no companion
      await firstValueFrom(service.setSubclassChoices(ID, { vestigeDomain: 'Life' }));
      expect(followers()).toEqual([]);

      await firstValueFrom(service.setSubclassChoices(ID, { vestigeType: 'Celestial' }));
      expect(vestige().statBlock.hp).toEqual({ max: 32, cur: 32, temp: 0 });
    });

    it('is removed when the subclass changes or the level drops below 3', async () => {
      const pc = seed({ level: 5, subclassChoices: FIEND_WAR });
      await firstValueFrom(service.updatePC(pc));
      expect(followers().length).toBe(1);
      await firstValueFrom(service.updatePC({ ...pc, subclass: 'Fiend Patron' }));
      expect(followers()).toEqual([]);

      const again = seed({ level: 3, subclassChoices: FIEND_WAR });
      await firstValueFrom(service.updatePC(again));
      expect(followers().length).toBe(1);
      await firstValueFrom(service.updatePCAsDm({ ...again, level: 2 }));
      expect(followers()).toEqual([]);
    });

    it('never gives one to another patron or another class, whatever they do', async () => {
      const fiend = seed({ subclass: 'Fiend Patron', level: 2 });
      await firstValueFrom(service.levelUp(ID));
      await firstValueFrom(service.updatePC({ ...fiend, level: 3, stats: { ...fiend.stats!, CHA: 20 } }));
      expect(followers()).toEqual([]);

      const cleric = seed({ clazz: 'Cleric', subclass: 'Life Domain', level: 5 });
      await firstValueFrom(service.levelUp(ID));
      await firstValueFrom(service.updatePCAsDm({ ...cleric, stats: { ...cleric.stats!, CHA: 20 } }));
      expect(followers()).toEqual([]);
    });
  });
});

/** Against the server the client builds nothing: it only reads the followers again when the vestige may have changed. */
describe('PCService Vestige Patron (follower reloads)', () => {
  let service: PCService;
  let httpMock: HttpTestingController;
  let reloads: number[];

  const patron = (over: Partial<PC> = {}): PC => ({
    id: 42, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 5, playerName: 'Sam', prof: 3,
    stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 16 }, languages: ['Common'],
    subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' },
    ...over,
  });
  /** A PC the way the server sends it: the nested fields flattened, the stored choices as an object. */
  const answer = (pc: PC) => ({
    ...(service as unknown as { serializePC(p: PC): Record<string, unknown> }).serializePC(pc),
    subclassChoices: pc.subclassChoices ?? null,
  });

  beforeEach(() => {
    localStorage.removeItem(DEMO_MODE_KEY);
    TestBed.configureTestingModule({
      providers: [PCService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(PCService);
    httpMock = TestBed.inject(HttpTestingController);
    reloads = [];
    TestBed.inject(FollowerService).changes$.subscribe(c => reloads.push(c.pcId));
  });

  afterEach(() => httpMock.verify());

  const hold = (pc: PC) => { service.setPCs([pc]); service.setActivePC(pc); };
  const flush = (suffix: string, pc: PC) =>
    httpMock.expectOne(r => r.url.endsWith(suffix)).flush(answer(pc));

  it('reloads the followers after a level-up, the player\'s and the DM\'s', () => {
    hold(patron());
    service.levelUp(42).subscribe();
    flush('/42/level-up', patron({ level: 6 }));
    service.levelUpAsDm(42).subscribe();
    flush('/42/level-up/as-dm', patron({ level: 7 }));
    expect(reloads).toEqual([42, 42]);
  });

  it('reloads them after a sheet save that changes Charisma, and not after one that does not', () => {
    hold(patron());
    service.updatePC(patron({ bio: 'Bound at the Hollow Ford.' })).subscribe();
    flush('/pc/42', patron({ bio: 'Bound at the Hollow Ford.' }));
    expect(reloads).toEqual([]);

    service.updatePC(patron({ stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 18 } })).subscribe();
    flush('/pc/42', patron({ stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 18 } }));
    expect(reloads).toEqual([42]);

    service.updatePCAsDm(patron({ stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 20 } })).subscribe();
    flush('/42/as-dm', patron({ stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 20 } }));
    expect(reloads).toEqual([42, 42]);
  });

  it('reloads them when a save loses the subclass or changes the level, the languages or the bonus lines', () => {
    for (const change of [
      { subclass: 'Fiend Patron' }, { level: 6 }, { languages: ['Common', 'Infernal'] },
      { statAdjustments: { prof: [{ value: 1, label: 'Blessing' }] } },
    ] as Partial<PC>[]) {
      hold(patron());
      reloads.length = 0;
      service.updatePCAsDm(patron(change)).subscribe();
      flush('/42/as-dm', patron(change));
      expect(reloads).withContext(JSON.stringify(change)).toEqual([42]);
    }
  });

  it('reloads them after the Vestige type is changed on the sheet', () => {
    hold(patron());
    service.setSubclassChoices(42, { vestigeType: 'Undead' }).subscribe();
    flush('/42/subclass-choices', patron({ subclassChoices: { vestigeType: 'Undead', vestigeDomain: 'War' } }));
    expect(reloads).toEqual([42]);
  });

  it('never reloads them for a character that is not, and was not, a Vestige Patron', () => {
    const fighter = patron({ clazz: 'Fighter', subclass: 'Champion', subclassChoices: null });
    hold(fighter);
    service.updatePC({ ...fighter, stats: { ...fighter.stats!, CHA: 20 } }).subscribe();
    flush('/pc/42', { ...fighter, stats: { ...fighter.stats!, CHA: 20 } });
    service.levelUp(42).subscribe();
    flush('/42/level-up', { ...fighter, level: 6 });
    service.updatePCAsDm(patron({ subclass: 'Fiend Patron' })).subscribe();
    flush('/42/as-dm', patron({ subclass: 'Fiend Patron' }));
    // Neither the copy held before each write nor the answer was a Vestige Patron.
    expect(reloads).toEqual([]);
  });
});
