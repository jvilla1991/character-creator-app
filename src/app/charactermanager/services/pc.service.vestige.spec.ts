import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { DEMO_MODE_KEY } from 'src/environments/environment';

import { PCService } from './pc.service';
import { PC, PcSpell } from '../models/pc';

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
});
