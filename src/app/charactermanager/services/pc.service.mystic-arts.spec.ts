import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PCService } from './pc.service';
import { PC, PcSpell } from '../models/pc';
import { DEMO_MODE_KEY } from 'src/environments/environment';

const MYSTIC_ARTS = 'Warrior of the Mystic Arts';

function makeMonk(overrides: Partial<PC> = {}): PC {
  return {
    id: 42, name: 'Shen', clazz: 'Monk', subclass: MYSTIC_ARTS, level: 8, playerName: 'Sam', race: 'Human',
    hp: { cur: 50, max: 50, temp: 0 }, prof: 3,
    stats: { STR: 10, DEX: 16, CON: 14, INT: 8, WIS: 16, CHA: 10 },
    spells: [], features: [], skills: {},
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 1 } },
    classResources: { focusPoints: 5 },
    ...overrides,
  };
}

// demoMode reads localStorage live, so the flag is set before the service is constructed.
describe('PCService Warrior of the Mystic Arts (demo mode)', () => {
  let service: PCService;
  const ID = 901;

  beforeEach(() => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    TestBed.configureTestingModule({
      imports: [],
      providers: [PCService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(PCService);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify(); // demo mode never calls the server
    localStorage.removeItem(DEMO_MODE_KEY);
  });

  /** Put a character in the demo store and return it. */
  function seed(over: Partial<PC> = {}): PC {
    const pc = makeMonk({ id: ID, campaignId: null, ...over });
    const store = service as unknown as { pcs: PC[] };
    store.pcs = [...store.pcs.filter(p => p.id !== ID), pc];
    return pc;
  }
  const stored = () => service.getPCById(ID)!;
  const spell = (lvl: number, name: string): PcSpell => ({ lvl, name, school: 'evocation', time: 'action', prepared: true });

  describe('level-up preview', () => {
    it('at Monk 3 carries the subclass\'s spellcasting under its name, and nothing for the others', async () => {
      seed({ level: 2, subclass: undefined, spellSlots: {}, classResources: {} });

      const preview = await firstValueFrom(service.levelUpPreview(ID));

      expect(preview.subclassDue).toBeTrue();
      expect(preview.subclassOptions).toContain(MYSTIC_ARTS);
      expect(preview.newSpellSlots).toEqual({});
      expect(preview.newCantripsKnown).toBe(0);
      expect(preview.newSpellsKnown).toBe(0);
      expect(preview.spellcastingBySubclass).toEqual({
        [MYSTIC_ARTS]: { newSpellSlots: { 1: 2 }, newCantripsKnown: 2, newSpellsKnown: 3 },
      });
    });

    it('counts the DM\'s bonus slot lines in the subclass\'s slots, like the server', async () => {
      seed({ level: 2, subclass: undefined, spellSlots: {}, statAdjustments: { slot1: [{ value: 1, label: 'Boon' }] } });

      const preview = await firstValueFrom(service.levelUpPreview(ID));

      expect(preview.newSpellSlots).toEqual({ 1: 1 });
      expect(preview.spellcastingBySubclass![MYSTIC_ARTS].newSpellSlots).toEqual({ 1: 3 });
    });

    it('of a Mystic Arts monk uses its table: Monk 9 to 10 is the third cantrip', async () => {
      seed({ level: 9, spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } } });

      const preview = await firstValueFrom(service.levelUpPreview(ID));

      expect(preview.newSpellSlots).toEqual({ 1: 4, 2: 3 });
      expect([preview.currentCantripsKnown, preview.newCantripsKnown]).toEqual([2, 3]);
      expect([preview.currentSpellsKnown, preview.newSpellsKnown]).toEqual([6, 7]);
      expect(preview.spellcastingBySubclass).toEqual({});
    });

    it('offers the Spellcasting feats to the Mystic Arts monk only', async () => {
      seed({ level: 3 });
      expect((await firstValueFrom(service.levelUpPreview(ID))).featOptions).toContain('Evocation Adept');
      seed({ level: 3, subclass: 'Warrior of the Open Hand', spellSlots: {} });
      expect((await firstValueFrom(service.levelUpPreview(ID))).featOptions).not.toContain('Evocation Adept');
    });

    it('is empty of it for the classes whose subclasses bring no spellcasting here', async () => {
      for (const clazz of ['Fighter', 'Rogue', 'Cleric', 'Wizard', 'Paladin']) {
        seed({ clazz, level: 2, subclass: undefined, spellSlots: {}, classResources: {} });
        const preview = await firstValueFrom(service.levelUpPreview(ID));
        expect(preview.subclassDue).withContext(clazz).toBeTrue();
        expect(preview.spellcastingBySubclass).withContext(clazz).toEqual({});
      }
    });
  });

  describe('level-up', () => {
    it('picking the subclass at Monk 3 learns the five spells and gives the slots at once', async () => {
      seed({ level: 2, subclass: undefined, spellSlots: {}, classResources: {} });
      const picks = [spell(0, 'Blade Ward'), spell(0, 'Thunderclap'), spell(1, 'Jump'), spell(1, 'Magic Missile'),
        spell(1, 'Shield')];

      const updated = await firstValueFrom(service.levelUp(ID, { subclass: MYSTIC_ARTS, newSpells: picks }));

      expect(updated.level).toBe(3);
      expect(updated.subclass).toBe(MYSTIC_ARTS);
      expect(updated.spellSlots).toEqual({ 1: { max: 2, used: 0 } });
      expect(updated.spells!.map(s => s.name)).toEqual(['Blade Ward', 'Thunderclap', 'Jump', 'Magic Missile', 'Shield']);
      expect(stored().spellSlots).toEqual({ 1: { max: 2, used: 0 } });
    });

    it('rebuilds the slots from its table at a later level, keeping what is spent', async () => {
      seed({ level: 6, spellSlots: { 1: { max: 3, used: 2 } } });

      const updated = await firstValueFrom(service.levelUp(ID));

      expect(updated.spellSlots).toEqual({ 1: { max: 4, used: 2 }, 2: { max: 2, used: 0 } });
    });

    it('another Monk subclass gets no slots', async () => {
      seed({ level: 2, subclass: undefined, spellSlots: {}, classResources: {} });
      const updated = await firstValueFrom(service.levelUp(ID, { subclass: 'Warrior of the Open Hand' }));
      expect(updated.spellSlots).toEqual({});
    });
  });
});
