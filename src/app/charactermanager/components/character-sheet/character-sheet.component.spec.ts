import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';

import { CharacterSheetComponent } from './character-sheet.component';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { SessionService } from '../../services/session.service';
import { FollowerService } from '../../services/follower.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { PC } from '../../models/pc';
import { Follower } from '../../models/follower';

function makePC(overrides: Partial<PC> = {}): PC {
  return { id: 7, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben', ...overrides };
}

describe('CharacterSheetComponent', () => {
  let component: CharacterSheetComponent;
  let pcService: jasmine.SpyObj<PCService>;
  let grantService: jasmine.SpyObj<GrantService>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let followerService: jasmine.SpyObj<FollowerService>;
  let uiState: UiStateService;

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService',
      ['updatePC', 'updatePCAsDm', 'setInspirationPips', 'useInspiration']);
    grantService = jasmine.createSpyObj<GrantService>('GrantService', ['grantToPc']);
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['refresh']);
    followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['update']);
    uiState = TestBed.inject(UiStateService);
    component = TestBed.runInInjectionContext(
      () => new CharacterSheetComponent(pcService, grantService, sessionService, followerService, uiState));
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

  // --- Header class suffix (hero classes) ---

  it('builds the header suffix from subclass and specialization', () => {
    component.pc = makePC({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost' });
    expect(component.subtitleSuffix).toBe('Oath of the Ebon Blade · Frost Rune');
    // WoW Druid before level 3: "Druid (Balance)"
    component.pc = makePC({ clazz: 'Druid', specialization: 'Balance' });
    expect(component.heroClass).toBeTrue();
    expect(component.subtitleSuffix).toBe('Balance');
    component.pc = makePC({ clazz: 'Druid', subclass: 'Circle of the Moon', specialization: 'Guardian' });
    expect(component.subtitleSuffix).toBe('Circle of the Moon · Guardian');
    // A base druid is unchanged.
    component.pc = makePC({ clazz: 'Druid', subclass: 'Circle of the Land', specialization: null });
    expect(component.heroClass).toBeFalse();
    expect(component.subtitleSuffix).toBe('Circle of the Land');
    // WoW Paladin: "Paladin (Holy)", then the oath joins it from level 3.
    component.pc = makePC({ clazz: 'Paladin', subclass: undefined, specialization: 'Holy' });
    expect(component.heroClass).toBeTrue();
    expect(component.subtitleSuffix).toBe('Holy');
    component.pc = makePC({ clazz: 'Paladin', subclass: 'Oath of Vengeance', specialization: 'Retribution' });
    expect(component.subtitleSuffix).toBe('Oath of Vengeance · Retribution');
    // WoW Rogue: "Rogue (Outlaw)", then the subclass joins it from level 3.
    component.pc = makePC({ clazz: 'Rogue', subclass: undefined, specialization: 'Outlaw' });
    expect(component.heroClass).toBeTrue();
    expect(component.subtitleSuffix).toBe('Outlaw');
    component.pc = makePC({ clazz: 'Rogue', subclass: 'Swashbuckler', specialization: 'Outlaw' });
    expect(component.subtitleSuffix).toBe('Swashbuckler · Outlaw');
    // WoW Shaman: "Shaman (Barbarian) (Elemental)", then the path joins it from level 3.
    component.pc = makePC({ clazz: 'Barbarian', subclass: undefined, specialization: 'Elemental' });
    expect(component.heroClass).toBeTrue();
    expect(component.subtitleSuffix).toBe('Elemental');
    component.pc = makePC({ clazz: 'Barbarian', subclass: 'Path of the Elements', specialization: 'Elemental' });
    expect(component.subtitleSuffix).toBe('Path of the Elements · Elemental');
    component.pc = makePC({ clazz: 'Barbarian', subclass: 'Path of the Berserker', specialization: null });
    expect(component.heroClass).toBeFalse();
    expect(component.subtitleSuffix).toBe('Path of the Berserker');
    // WoW Warlock: the patron is chosen at level 1, so it joins the spec from the start.
    component.pc = makePC({ clazz: 'Warlock', subclass: 'Fiend Patron', specialization: 'Demonology' });
    expect(component.heroClass).toBeTrue();
    expect(component.subtitleSuffix).toBe('Fiend Patron · Demonology');
    component.pc = makePC({ clazz: 'Warlock', subclass: undefined, specialization: 'Affliction' });
    expect(component.subtitleSuffix).toBe('Affliction');
    component.pc = makePC({ clazz: 'Warlock', subclass: 'Great Old One Patron', specialization: null });
    expect(component.heroClass).toBeFalse();
    expect(component.subtitleSuffix).toBe('Great Old One Patron');
    // WoW Warrior: "Warrior (Fighter) (Arms)", then the subclass joins it from level 3.
    component.pc = makePC({ clazz: 'Fighter', subclass: undefined, specialization: 'Arms' });
    expect(component.heroClass).toBeTrue();
    expect(component.subtitleSuffix).toBe('Arms');
    component.pc = makePC({ clazz: 'Fighter', subclass: 'Battle Master', specialization: 'Protection' });
    expect(component.subtitleSuffix).toBe('Battle Master · Protection');
    component.pc = makePC({ clazz: 'Fighter', subclass: 'Champion', specialization: null });
    expect(component.heroClass).toBeFalse();
    expect(component.subtitleSuffix).toBe('Champion');
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

  it('tells the user when a sheet save fails and leaves the confirmed sheet showing', () => {
    const error = new Error('network down');
    pcService.updatePC.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');
    const before = component.pc;

    component.onExhaustionChange(3);

    expect(notify).toHaveBeenCalledWith('Could not save that change. Try again.', error);
    expect(component.pc).toBe(before);
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

  it('tells the user if the grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');

    component.onFeatureGrant({ name: 'Blessing', source: 'DM Grant', desc: '' });

    expect(notify).toHaveBeenCalledWith('Could not grant the feature. Try again.', error);
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

  it('tells the user if the other-feature grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');

    component.onOtherFeatureGrant({ name: 'Darkvision', source: 'Species', desc: '' });

    expect(notify).toHaveBeenCalledWith('Could not grant the feature. Try again.', error);
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

  it('tells the user if the spell grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');

    component.onSpellsGrant([{ lvl: 0, name: 'Light', school: 'Evocation', time: 'action', prepared: true }]);

    expect(notify).toHaveBeenCalledWith('Could not grant the spells. Try again.', error);
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

  it('tells the user if the item grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');

    component.onItemGrant({ name: 'Rope', category: 'gear', qty: 1 });

    expect(notify).toHaveBeenCalledWith('Could not grant the item. Try again.', error);
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

  // --- Followers: opening one from the character's sheet ---

  describe('followers', () => {
    const brannoc = (): Follower =>
      ({ id: 12, pcId: 7, name: 'Brannoc', statBlock: { clazz: 'Guard', level: 2, ac: 16 } });

    afterEach(() => uiState.closeFollower());

    it('opening a follower exposes it as a PC for the nested follower sheet', () => {
      expect(component.openFollowerPc()).toBeNull();

      component.onFollowerOpened(brannoc());

      expect(uiState.openFollowerId()).toBe(12);
      expect(component.openFollowerPc()).toEqual(jasmine.objectContaining(
        { id: -12, name: 'Brannoc', clazz: 'Guard', level: 2, ac: 16 }));
    });

    it('closeFollower (Back to Character) returns to the character sheet', () => {
      component.onFollowerOpened(brannoc());

      component.closeFollower();

      expect(component.openFollowerPc()).toBeNull();
      expect(uiState.openFollowerId()).toBeNull();
    });

    it('the browser Back button (UiState closing the follower) also returns to the character', () => {
      component.onFollowerOpened(brannoc());

      uiState.closeFollower(); // what applyClose('follower') does on popstate

      expect(component.openFollowerPc()).toBeNull();
    });

    it('a follower sheet edit is applied at once and saved through FollowerService', () => {
      followerService.update.and.returnValue(of(brannoc()));
      component.onFollowerOpened(brannoc());
      const edited = { ...component.openFollowerPc()!, name: 'Sir Brannoc', ac: 18 };

      component.onFollowerChanged(edited);

      expect(followerService.update).toHaveBeenCalledWith(7, 12, 'Sir Brannoc',
        { clazz: 'Guard', level: 2, ac: 18 });
      expect(component.openFollowerPc()).toEqual(jasmine.objectContaining({ name: 'Sir Brannoc', ac: 18 }));
      // A follower is not a PC row — the character endpoints are never touched.
      expect(pcService.updatePC).not.toHaveBeenCalled();
      expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
    });

    it('a failed follower save reverts to the last confirmed sheet and says so', () => {
      const notify = spyOn(TestBed.inject(NotificationService), 'error');
      followerService.update.and.returnValue(throwError(() => new Error('500')));
      component.onFollowerOpened(brannoc());

      component.onFollowerChanged({ ...component.openFollowerPc()!, ac: 18 });

      expect(component.openFollowerPc()?.ac).toBe(16);
      expect(notify).toHaveBeenCalledWith(jasmine.stringMatching(/^Could not save .*undone/), jasmine.anything());
    });

    it('switching to a different character closes the open follower', () => {
      component.onFollowerOpened(brannoc());
      const previous = component.pc;
      component.pc = makePC({ id: 8, name: 'Aelindra' });

      component.ngOnChanges({ pc: new SimpleChange(previous, component.pc, false) });

      expect(component.openFollowerPc()).toBeNull();
      expect(uiState.openFollowerId()).toBeNull();
    });

    it('a refresh of the same character keeps the follower open', () => {
      component.onFollowerOpened(brannoc());
      const previous = component.pc;
      component.pc = makePC({ ac: 17 });

      component.ngOnChanges({ pc: new SimpleChange(previous, component.pc, false) });

      expect(component.openFollowerPc()).not.toBeNull();
    });

    it('destroying the sheet abandons the follower view', () => {
      component.onFollowerOpened(brannoc());

      component.ngOnDestroy();

      expect(uiState.openFollowerId()).toBeNull();
    });
  });

  // --- Follower mode: this sheet IS the follower's ---

  describe('follower mode', () => {
    let changed: jasmine.Spy;

    beforeEach(() => {
      component.followerMode = true;
      component.pc = makePC({ id: -12, name: 'Brannoc', clazz: 'Guard', level: 2 });
      changed = spyOn(component.followerChanged, 'emit');
    });

    it('saves by emitting followerChanged instead of calling the PC endpoints', () => {
      component.onPcChange(makePC({ id: -12, ac: 18 }));

      expect(changed).toHaveBeenCalledWith(jasmine.objectContaining({ id: -12, ac: 18 }));
      expect(pcService.updatePC).not.toHaveBeenCalled();
      expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
    });

    it('a DM edit in follower mode also emits (the DM path is a PC endpoint)', () => {
      component.editable = true;
      const applied = makePC({ id: -12, ac: 18 });
      component.onDmEditRequested({ label: 'AC', value: 16, min: 0, max: null, apply: () => applied });

      component.onDmEditConfirmed({ value: 18, description: 'shield' });

      expect(changed).toHaveBeenCalledWith(applied);
      expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
    });

    it('grants mutate the follower sheet directly, never through GrantService', () => {
      component.onItemGrant({ name: 'Rope', category: 'gear', qty: 1 });
      component.onFeatureGrant({ name: 'Blessing', source: 'DM Grant', desc: '' });

      expect(grantService.grantToPc).not.toHaveBeenCalled();
      expect(changed.calls.argsFor(0)[0].inventory).toEqual([{ name: 'Rope', category: 'gear', qty: 1 }]);
      expect(changed.calls.argsFor(1)[0].features).toEqual([{ name: 'Blessing', source: 'DM Grant', desc: '' }]);
    });

    it('inspiration is plain sheet data: filling the meter grants the badge locally', () => {
      component.onInspirationChange(3);
      component.onInspirationChange(5);
      component.useInspiration();

      expect(changed.calls.argsFor(0)[0].inspirationPips).toBe(3);
      expect(changed.calls.argsFor(1)[0]).toEqual(
        jasmine.objectContaining({ inspirationPips: 0, heroicInspiration: true }));
      expect(changed.calls.argsFor(2)[0].heroicInspiration).toBeFalse();
      expect(pcService.setInspirationPips).not.toHaveBeenCalled();
      expect(pcService.useInspiration).not.toHaveBeenCalled();
    });

    it('leaves the bottom-tab-bar body flag to its character\'s sheet', () => {
      document.body.classList.add('has-bottom-tab-bar'); // set by the outer sheet

      component.ngOnInit();
      component.ngOnDestroy(); // "Back to Character" destroys only the nested sheet

      expect(document.body.classList.contains('has-bottom-tab-bar')).toBeTrue();
      document.body.classList.remove('has-bottom-tab-bar');
    });

    it('its own pc changing on every save never closes a follower view', () => {
      const closing = spyOn(uiState, 'closeFollower');
      const previous = component.pc;
      component.pc = makePC({ id: -13 });

      component.ngOnChanges({ pc: new SimpleChange(previous, component.pc, false) });
      component.ngOnDestroy();

      expect(closing).not.toHaveBeenCalled();
    });
  });
});
