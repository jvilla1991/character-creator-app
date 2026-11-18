import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SpellEli5Service } from './spell-eli5.service';
import { DndResourcesService } from './dnd-resources.service';
import { PreferencesService } from './preferences.service';
import { UI_ROLE_KEY, UiStateService } from './ui-state.service';
import { DndSpell } from '../models/dnd-api.types';

const ELI5_KEY = 'tm_eli5';

function dndSpell(name: string, eli5?: string): DndSpell {
  return {
    name, level: 1, school: 'evocation', classes: ['wizard'], actionType: 'action',
    concentration: false, ritual: false, range: '60 feet', components: ['v'],
    duration: 'Instantaneous', description: 'The long rules text.', eli5,
  };
}

// TestBed (not the class-only house style): the service registers an effect()
// in its constructor, and the lazy catalog load needs TestBed.tick() to flush it.
describe('SpellEli5Service', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;

  const clearStorage = (): void => {
    localStorage.removeItem(ELI5_KEY);
    localStorage.removeItem(UI_ROLE_KEY);
  };

  beforeEach(() => {
    clearStorage();
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of([
      dndSpell('Fireball', 'Blast a 20-foot ball of fire.'),
      dndSpell('Rune Strike'), // placeholder entry: no summary written
    ]));
    TestBed.configureTestingModule({
      providers: [{ provide: DndResourcesService, useValue: dndResources }],
    });
  });
  afterEach(clearStorage);

  const create = (): SpellEli5Service => TestBed.inject(SpellEli5Service);

  it('is off by default and does not fetch the spell catalog', () => {
    const service = create();
    TestBed.tick();

    expect(service.enabled()).toBeFalse();
    expect(service.active()).toBeFalse();
    expect(service.summaryFor('Fireball')).toBeNull();
    expect(dndResources.getSpells).not.toHaveBeenCalled();
  });

  it('toggle() flips the choice and persists it', () => {
    const service = create();

    service.toggle();
    expect(service.enabled()).toBeTrue();
    expect(localStorage.getItem(ELI5_KEY)).toBe('true');

    service.toggle();
    expect(service.enabled()).toBeFalse();
    expect(localStorage.getItem(ELI5_KEY)).toBe('false');
  });

  it('restores a saved "on" choice', () => {
    localStorage.setItem(ELI5_KEY, 'true');

    expect(create().enabled()).toBeTrue();
  });

  it('looks summaries up by spell name, case-insensitively, once switched on', () => {
    const service = create();
    service.toggle();
    TestBed.tick();

    expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
    expect(service.summaryFor('Fireball')).toBe('Blast a 20-foot ball of fire.');
    expect(service.summaryFor('FIREBALL')).toBe('Blast a 20-foot ball of fire.');
  });

  it('returns null for spells with no summary so the full text shows instead', () => {
    const service = create();
    service.toggle();
    TestBed.tick();

    expect(service.summaryFor('Rune Strike')).toBeNull();
    expect(service.summaryFor('My Homebrew Spell')).toBeNull();
  });

  it('is unavailable and inactive in the DM view, even when switched on', () => {
    const service = create();
    service.toggle();
    TestBed.inject(UiStateService).setRole('dm');
    TestBed.tick();

    expect(service.available()).toBeFalse();
    expect(service.active()).toBeFalse();
    expect(service.summaryFor('Fireball')).toBeNull();
  });

  it('is unavailable while a DM is cross-linked into a member sheet', () => {
    const service = create();
    const uiState = TestBed.inject(UiStateService);
    spyOn(history, 'pushState'); // viewHeroAsDm pushes an overlay history entry
    service.toggle();
    uiState.setRole('dm');
    uiState.viewHeroAsDm(); // displayed role becomes 'player', but not by choice

    expect(uiState.isPlayer()).toBeTrue();
    expect(service.available()).toBeFalse();
    expect(service.active()).toBeFalse();
  });

  it('fetches the catalog only once across repeated toggles', () => {
    const service = create();
    service.toggle(); TestBed.tick();
    service.toggle(); TestBed.tick();
    service.toggle(); TestBed.tick();

    expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
  });

  it('retries the catalog after a failed load', () => {
    dndResources.getSpells.and.returnValue(throwError(() => new Error('offline')));
    const service = create();
    service.toggle(); TestBed.tick();
    expect(service.summaryFor('Fireball')).toBeNull();

    dndResources.getSpells.and.returnValue(of([dndSpell('Fireball', 'Blast a 20-foot ball of fire.')]));
    service.toggle(); TestBed.tick(); // off
    service.toggle(); TestBed.tick(); // on again → retry

    expect(service.summaryFor('Fireball')).toBe('Blast a 20-foot ball of fire.');
  });

  it('shares its on/off state with PreferencesService', () => {
    const service = create();

    TestBed.inject(PreferencesService).setEli5(true);

    expect(service.enabled()).toBeTrue();
  });
});
