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

  // --- Connect / Join Campaign ---

  it('onConnectClick emits connectRequested', () => {
    const emitted = spyOn(component.connectRequested, 'emit');

    component.onConnectClick();

    expect(emitted).toHaveBeenCalled();
  });

  it('joinCampaignRequested is emittable (template binds it for characters not in a campaign)', () => {
    const emitted = spyOn(component.joinCampaignRequested, 'emit');

    component.joinCampaignRequested.emit();

    expect(emitted).toHaveBeenCalled();
  });

  it('inCampaign reflects the pc campaign binding', () => {
    component.pc = makePC({ campaignId: 3 });
    expect(component.inCampaign).toBeTrue();

    component.pc = makePC({ campaignId: undefined });
    expect(component.inCampaign).toBeFalse();
  });

  // --- Level Up gating ---

  it('canLevelUp is false without XP, a grant, or DM cross-link mode', () => {
    component.pc = makePC({ level: 4, xp: 0 });
    expect(component.canLevelUp).toBeFalse();
  });

  it('canLevelUp is always true in DM cross-link (editable) mode', () => {
    component.pc = makePC({ level: 4, xp: 0 });
    component.editable = true;
    expect(component.canLevelUp).toBeTrue();
    expect(component.levelUpHint).toContain('no XP threshold');
  });

  it('canLevelUp is true when the DM granted a pending level-up', () => {
    component.pc = makePC({ level: 4, xp: 0, pendingLevelGrant: true });
    expect(component.canLevelUp).toBeTrue();
  });

  // --- Exhaustion (conditions panel tracker) ---

  it('persists a new exhaustion level via the owner path on the player\'s own sheet', () => {
    pcService.updatePC.and.returnValue(of(makePC()));

    component.onExhaustionChange(3);

    expect(pcService.updatePC).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 7, exhaustion: 3 }));
    expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
  });

  it('persists exhaustion via the DM-authorized path in cross-link mode', () => {
    pcService.updatePCAsDm.and.returnValue(of(makePC()));
    component.editable = true;

    component.onExhaustionChange(6);

    expect(pcService.updatePCAsDm).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 7, exhaustion: 6 }), null);
    expect(pcService.updatePC).not.toHaveBeenCalled();
  });

  it('clamps the exhaustion level to the 0–6 range', () => {
    pcService.updatePC.and.returnValue(of(makePC()));

    component.onExhaustionChange(9);
    expect(pcService.updatePC).toHaveBeenCalledWith(
      jasmine.objectContaining({ exhaustion: 6 }));

    component.onExhaustionChange(-2);
    expect(pcService.updatePC).toHaveBeenCalledWith(
      jasmine.objectContaining({ exhaustion: 0 }));
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

  // --- DM "other feature" grants (Other Features panel) ---

  it('grants an other-feature via GrantService, stamping category other onto the entry', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    const granted = { name: 'Darkvision', source: 'Species', desc: 'See in the dark.' };

    component.onOtherFeatureGrant(granted);

    expect(grantService.grantToPc).toHaveBeenCalledWith(7, jasmine.any(Function));
    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    const fresh: PC = makePC({
      features: [{ name: 'Rage', source: 'Barbarian 1', desc: 'Reckless fury.' }],
    });

    const result = mutate(fresh);

    expect(result.features).toEqual([
      { name: 'Rage', source: 'Barbarian 1', desc: 'Reckless fury.' },
      { name: 'Darkvision', source: 'Species', desc: 'See in the dark.', category: 'other' },
    ]);
    // Purity: the fresh copy must not be mutated in place.
    expect(fresh.features?.length).toBe(1);
    expect(result).not.toBe(fresh);
  });

  it('appends an other-feature to an undefined features list on the fresh pc', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));

    component.onOtherFeatureGrant({ name: 'Stone Sense', source: 'Boon', desc: '' });

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    const result = mutate(makePC({ features: undefined }));

    expect(result.features).toEqual([
      { name: 'Stone Sense', source: 'Boon', desc: '', category: 'other' },
    ]);
  });

  it('logs an error if the other-feature grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const consoleSpy = spyOn(console, 'error');

    component.onOtherFeatureGrant({ name: 'Darkvision', source: 'Species', desc: '' });

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

  // --- DM equipment grants ---

  it('stacks a granted catalog item onto an existing line with the same catalogKey', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    component.onItemGrant({ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 2 });

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    const fresh: PC = makePC({ inventory: [{ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1 }] });
    const freshInv = fresh.inventory;

    const result = mutate(fresh);

    expect(result.inventory).toEqual([{ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 3 }]);
    // Purity: the fresh inventory array/objects are not mutated in place.
    expect(fresh.inventory).toBe(freshInv);
    expect(fresh.inventory![0].qty).toBe(1);
  });

  it('backfills bulk/weight onto an unstamped line when stacking, without overwriting stamped values', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    component.onItemGrant({ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1, weight: 3, bulk: 3 });

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    // A pre-slot-variant line: never stamped, weight-band display would say 2.
    const unstamped: PC = makePC({ inventory: [{ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1, weight: 3 }] });
    expect(mutate(unstamped).inventory).toEqual([
      { catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 2, weight: 3, bulk: 3 },
    ]);

    // An already-stamped line keeps its own rating.
    component.onItemGrant({ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1, weight: 3, bulk: 3 });
    const mutate2 = grantService.grantToPc.calls.mostRecent().args[1];
    const stamped: PC = makePC({ inventory: [{ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1, weight: 3, bulk: 9 }] });
    expect(mutate2(stamped).inventory![0].bulk).toBe(9);
  });

  it('appends an ad-hoc granted item (no catalogKey) rather than stacking', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    const granted = { name: 'Cracked Fang', category: 'gear' as const, qty: 1 };
    component.onItemGrant(granted);

    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    const result = mutate(makePC({ inventory: [{ name: 'Cracked Fang', category: 'gear', qty: 1 }] }));

    expect(result.inventory?.length).toBe(2);
  });

  it('logs an error if the item grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const consoleSpy = spyOn(console, 'error');

    component.onItemGrant({ name: 'Rope', category: 'gear', qty: 1 });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to grant item', error);
  });

  // --- persist / onPcChange: DM cross-link vs. player path ---

  it('DM cross-link (editable): onPcChange saves via the 2-arg DM-authorized path with no description', () => {
    component.editable = true;
    pcService.updatePCAsDm.and.returnValue(of(makePC()));

    const updated = makePC({ ac: 16 });
    component.onPcChange(updated);

    expect(pcService.updatePCAsDm).toHaveBeenCalledWith(updated, null);
    expect(pcService.updatePC).not.toHaveBeenCalled();
  });

  it('player path (not editable): onPcChange still calls updatePC only — regression guard', () => {
    component.editable = false;
    pcService.updatePC.and.returnValue(of(makePC()));

    const updated = makePC({ ac: 16 });
    component.onPcChange(updated);

    expect(pcService.updatePC).toHaveBeenCalledWith(updated);
    expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
  });

  // --- DM edit modal ---

  it('onDmEditRequested stores the request, opening the modal', () => {
    const request = { label: 'AC', value: 15, min: 0, max: null, apply: (v: number) => makePC({ ac: v }) };

    component.onDmEditRequested(request);

    expect(component.dmEdit).toBe(request);
  });

  it('onDmEditConfirmed applies the request and persists with the DM-authored description', () => {
    component.editable = true;
    pcService.updatePCAsDm.and.returnValue(of(makePC()));
    const applied = makePC({ ac: 16 });
    const request = { label: 'AC', value: 15, min: 0, max: null, apply: (v: number) => applied };
    component.onDmEditRequested(request);

    component.onDmEditConfirmed({ value: 16, description: 'DM changed AC 15 → 16 for cover' });

    expect(pcService.updatePCAsDm).toHaveBeenCalledWith(applied, 'DM changed AC 15 → 16 for cover');
    expect(component.dmEdit).toBeNull();
  });

  it('onDmEditConfirmed with a null description still saves (backend falls back to auto-diff)', () => {
    component.editable = true;
    pcService.updatePCAsDm.and.returnValue(of(makePC()));
    const applied = makePC({ ac: 16 });
    component.onDmEditRequested({ label: 'AC', value: 15, min: 0, max: null, apply: () => applied });

    component.onDmEditConfirmed({ value: 16, description: null });

    expect(pcService.updatePCAsDm).toHaveBeenCalledWith(applied, null);
  });

  it('onDmEditConfirmed does nothing when no request is pending', () => {
    component.onDmEditConfirmed({ value: 16, description: 'x' });

    expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
  });

  it('closeDmEdit clears the pending request without saving', () => {
    component.onDmEditRequested({ label: 'AC', value: 15, min: 0, max: null, apply: (v: number) => makePC({ ac: v }) });

    component.closeDmEdit();

    expect(component.dmEdit).toBeNull();
    expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
  });
});
