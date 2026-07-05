import { of, throwError } from 'rxjs';

import { CharacterSheetComponent } from './character-sheet.component';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { PC } from '../../models/pc';

function makePC(overrides: Partial<PC> = {}): PC {
  return { id: 7, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben', ...overrides };
}

describe('CharacterSheetComponent', () => {
  let component: CharacterSheetComponent;
  let pcService: jasmine.SpyObj<PCService>;
  let grantService: jasmine.SpyObj<GrantService>;

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['updatePC', 'updatePCAsDm']);
    grantService = jasmine.createSpyObj<GrantService>('GrantService', ['grantToPc']);
    component = new CharacterSheetComponent(pcService, grantService);
    component.pc = makePC();
  });

  // --- DM feature grants ---

  it('grants a feature via GrantService using this PC\'s id', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));

    component.onFeatureGrant({ name: 'Blessing', source: 'DM Grant', desc: 'A boon.' });

    expect(grantService.grantToPc).toHaveBeenCalledWith(7, jasmine.any(Function));
  });

  it('passes a mutator that appends the granted feature to the FRESH pc\'s features, without mutating it', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    const granted = { name: 'Blessing', source: 'DM Grant', desc: 'A boon.' };

    component.onFeatureGrant(granted);

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    // A "fresh" PC that differs from the sheet's own `component.pc` copy (simulates a
    // concurrent player edit landing between the sheet's load and this grant).
    const fresh: PC = makePC({
      name: 'Throk (updated by player)',
      features: [{ name: 'Rage', source: 'Barbarian 1', desc: 'Reckless fury.' }],
    });
    const freshFeaturesBefore = fresh.features;

    const result = mutate(fresh);

    expect(result.features).toEqual([
      { name: 'Rage', source: 'Barbarian 1', desc: 'Reckless fury.' },
      granted,
    ]);
    // Purity: the input object (and its features array) must not be mutated in place.
    expect(fresh.features).toBe(freshFeaturesBefore);
    expect(fresh.features?.length).toBe(1);
    expect(result).not.toBe(fresh);
  });

  it('appends to an empty/undefined features list on the fresh pc', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    const granted = { name: 'Blessing', source: 'DM Grant', desc: '' };

    component.onFeatureGrant(granted);

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    const fresh: PC = makePC({ features: undefined });

    const result = mutate(fresh);

    expect(result.features).toEqual([granted]);
  });

  it('logs an error if the grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const consoleSpy = spyOn(console, 'error');

    component.onFeatureGrant({ name: 'Blessing', source: 'DM Grant', desc: '' });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to grant feature', error);
  });

  // --- DM spell grants ---

  it('grants spells, deduping against the FRESH pc so a concurrently-learned spell is not re-added', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    const granted = [
      { lvl: 1, name: 'Cure Wounds', school: 'Abjuration', time: 'action', prepared: true },
      { lvl: 0, name: 'Guidance', school: 'Divination', time: 'action', prepared: true },
    ];

    component.onSpellsGrant(granted);

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    // Fresh pc already learned "cure wounds" (different case) since the picker opened.
    const fresh: PC = makePC({ spells: [{ lvl: 1, name: 'cure wounds', school: 'Abjuration', time: 'action', prepared: true }] });
    const freshSpellsBefore = fresh.spells;

    const result = mutate(fresh);

    expect(result.spells?.map(s => s.name)).toEqual(['cure wounds', 'Guidance']);
    // Purity: input array untouched.
    expect(fresh.spells).toBe(freshSpellsBefore);
    expect(fresh.spells?.length).toBe(1);
  });

  it('appends granted spells onto an undefined spell list', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    const granted = [{ lvl: 0, name: 'Light', school: 'Evocation', time: 'action', prepared: true }];

    component.onSpellsGrant(granted);

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    const result = mutate(makePC({ spells: undefined }));

    expect(result.spells).toEqual(granted);
  });

  it('logs an error if the spell grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const consoleSpy = spyOn(console, 'error');

    component.onSpellsGrant([{ lvl: 0, name: 'Light', school: 'Evocation', time: 'action', prepared: true }]);

    expect(consoleSpy).toHaveBeenCalledWith('Failed to grant spells', error);
  });
});
