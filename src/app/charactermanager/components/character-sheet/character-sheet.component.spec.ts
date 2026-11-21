import { Subject, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';

import { CharacterSheetComponent } from './character-sheet.component';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { SessionService } from '../../services/session.service';
import { FollowerService } from '../../services/follower.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { PC, PcItem } from '../../models/pc';
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
  let followerChanges: Subject<{ pcId: number }>;

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService',
      ['updatePC', 'updatePCAsDm', 'setInspirationPips', 'useInspiration', 'setPetFamily',
        'spendSpellSlot', 'restoreSpellSlot', 'restoreAllSpellSlots', 'refreshSpellSlots']);
    grantService = jasmine.createSpyObj<GrantService>('GrantService', ['grantToPc']);
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['refresh', 'applySpellSlots']);
    followerChanges = new Subject<{ pcId: number }>();
    followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['update', 'list'],
      { changes$: followerChanges });
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
    // WoW Priest: "Priest (Cleric) (Shadow)", then the domain joins it from level 3.
    component.pc = makePC({ clazz: 'Cleric', subclass: undefined, specialization: 'Shadow' });
    expect(component.heroClass).toBeTrue();
    expect(component.subtitleSuffix).toBe('Shadow');
    component.pc = makePC({ clazz: 'Cleric', subclass: 'Discipline Domain', specialization: 'Discipline' });
    expect(component.subtitleSuffix).toBe('Discipline Domain · Discipline');
    component.pc = makePC({ clazz: 'Cleric', subclass: 'Life Domain', specialization: null });
    expect(component.heroClass).toBeFalse();
    expect(component.subtitleSuffix).toBe('Life Domain');
  });

  // --- Level Up gating ---
  // The gold Level Up button shows only when the character may advance; a DM
  // levels a member at any other time from the More actions menu.

  it('shows no Level Up button without enough XP or a grant — for a DM either', () => {
    component.pc = makePC({ level: 4, xp: 0 });
    expect(component.levelUpShown).toBeFalse();
    component.editable = true;
    expect(component.levelUpShown).toBeFalse();
  });

  it('shows Level Up once the XP crosses the next threshold', () => {
    component.pc = makePC({ level: 4, xp: 6_500 });
    expect(component.levelUpShown).toBeTrue();
    expect(component.levelUpHint).toBe('Enough XP to advance a level');
  });

  it('shows Level Up when the DM granted a pending level-up', () => {
    component.pc = makePC({ level: 4, xp: 0, pendingLevelGrant: true });
    expect(component.levelUpShown).toBeTrue();
    expect(component.levelUpHint).toBe('Your DM granted a level-up');
  });

  it('formats XP with thousands separators', () => {
    expect(component.formatXp(225000)).toBe('225,000');
    expect(component.formatXp(undefined)).toBe('0');
  });

  // --- More actions menu ---

  describe('More actions menu', () => {
    it('Delete character asks the host to confirm, for a player as for a DM', () => {
      const asked = spyOn(component.deleteRequested, 'emit');
      component.onMenuAction('delete');
      component.editable = true;
      component.onMenuAction('delete');
      expect(asked).toHaveBeenCalledTimes(2);
    });

    it('Rename character starts the name edit', () => {
      component.onMenuAction('rename');
      expect(component.editingName).toBeTrue();
      expect(component.nameDraft).toBe('Throk');
    });

    it('the portrait item opens the dialog, but never on a read-only embed or a follower', () => {
      component.onMenuAction('portrait');
      expect(component.portraitDialogOpen).toBeTrue();
      component.closePortraitDialog();

      component.showActions = false;
      component.onMenuAction('portrait');
      expect(component.portraitDialogOpen).toBeFalse();

      component.showActions = true;
      component.followerMode = true;
      component.onMenuAction('portrait');
      expect(component.portraitDialogOpen).toBeFalse();
    });

    it('the grant and Level up items act only for the DM', () => {
      pcService.grantLevelUp = jasmine.createSpy('grantLevelUp').and.returnValue(of(makePC()));
      const levelUp = spyOn(component.levelUpRequested, 'emit');
      component.onMenuAction('toggleGrant');
      component.onMenuAction('levelUp');
      expect(pcService.grantLevelUp).not.toHaveBeenCalled();
      expect(levelUp).not.toHaveBeenCalled();

      component.editable = true;
      component.onMenuAction('toggleGrant');
      component.onMenuAction('levelUp');
      expect(pcService.grantLevelUp).toHaveBeenCalledOnceWith(7, true);
      expect(levelUp).toHaveBeenCalled();
    });

    it('a different character taking over the sheet closes the portrait dialog', () => {
      component.openPortraitDialog();
      const previous = component.pc;
      component.pc = makePC({ id: 8 });
      component.ngOnChanges({ pc: new SimpleChange(previous, component.pc, false) });
      expect(component.portraitDialogOpen).toBeFalse();
    });
  });

  // --- Condition chips (red = has it, green = immune) ---

  it('saves both condition lists from a chip tap via the owner path', () => {
    pcService.updatePC.and.returnValue(of(makePC()));

    component.onConditionsChange({ conditions: ['prone'], conditionImmunities: ['charmed'] });

    expect(pcService.updatePC).toHaveBeenCalledWith(jasmine.objectContaining(
      { id: 7, conditions: ['prone'], conditionImmunities: ['charmed'] }));
  });

  it('saves a chip tap via the DM-authorized path in cross-link mode', () => {
    pcService.updatePCAsDm.and.returnValue(of(makePC()));
    component.editable = true;

    component.onConditionsChange({ conditions: [], conditionImmunities: ['poisoned'] });

    expect(pcService.updatePCAsDm).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 7, conditions: [], conditionImmunities: ['poisoned'] }), null);
  });

  it('hasDm follows the campaign, and for a follower its owner\'s campaign', () => {
    expect(component.hasDm).toBeFalse();
    component.pc = makePC({ campaignId: '3' });
    expect(component.hasDm).toBeTrue();

    component.followerMode = true;
    component.followerOwnerInCampaign = false;
    expect(component.hasDm).toBeFalse();
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

  // --- WoW Hunter pet family: its own endpoint, never the generic update ---

  it('saves a pet family (and "no pet") through setPetFamily, for the owner and the DM alike', () => {
    pcService.setPetFamily.and.returnValue(of(makePC()));
    component.pc = makePC({ id: 7 });

    component.onPetFamilyChange('Wolf');
    component.editable = true; // DM cross-link view
    component.onPetFamilyChange(null);

    expect(pcService.setPetFamily.calls.allArgs()).toEqual([[7, 'Wolf'], [7, null]]);
    expect(pcService.updatePC).not.toHaveBeenCalled();
    expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
  });

  it('tells the user when the pet family could not be saved', () => {
    const error = new Error('network down');
    pcService.setPetFamily.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');

    component.onPetFamilyChange('Bear');

    expect(notify).toHaveBeenCalledWith('Could not change the pet family. Try again.', error);
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

  // --- Number breakdown (Armor Class) and DM adjustment lines ---

  describe('AC breakdown', () => {
    /** DEX 14, chain shirt + shield: 13 + 2 + 2 = 17 from the gear. */
    const armoured = (overrides: Partial<PC> = {}): PC => makePC({
      stats: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      inventory: [
        { name: 'Chain Shirt', category: 'armor', qty: 1, equipped: true, armorClass: '13 + Dex modifier (max 2)' },
        { name: 'Shield', category: 'armor', qty: 1, equipped: true, armorClass: '+2' },
      ],
      ac: 17,
      campaignId: 3,
      ...overrides,
    });
    const taunka = { value: 1, label: 'Taunka' };

    it('opens with the lines that make up the number, for any viewer', () => {
      component.pc = armoured({ ac: 18, statAdjustments: { ac: [taunka] } });

      component.onBreakdownRequested('ac');

      expect(component.statBreakdown?.auto.map(l => l.label)).toEqual(['Chain Shirt', 'Dexterity', 'Shield']);
      expect(component.statBreakdown?.adjustments).toEqual([taunka]);
      expect(component.statBreakdown?.total).toBe(18);
    });

    it('lets the DM adjust, and nobody else in a campaign', () => {
      component.pc = armoured();
      component.showActions = true; // the player's own interactive sheet
      expect(component.canAdjustStats).toBeFalse();

      component.editable = true;    // DM cross-link
      expect(component.canAdjustStats).toBeTrue();
    });

    it('lets the owner adjust a character that is in no campaign, since it has no DM', () => {
      component.pc = armoured({ campaignId: null });
      component.showActions = true;
      expect(component.canAdjustStats).toBeTrue();

      component.showActions = false; // a read-only view of someone else's character
      expect(component.canAdjustStats).toBeFalse();
    });

    it('never offers adjustments on a follower', () => {
      component.pc = armoured();
      component.editable = true;
      component.followerMode = true;
      expect(component.canAdjustStats).toBeFalse();
    });

    it('saves a DM line through the refetch-merge-save grant path, on the FRESH character', () => {
      grantService.grantToPc.and.returnValue(of(makePC()));
      component.pc = armoured();
      component.editable = true;
      component.onBreakdownRequested('ac');

      component.onStatAdjustmentsSaved({ lines: [taunka], keepUnlabelled: true, removed: [], fromBase: 0 });

      expect(component.statBreakdown).toBeNull();
      expect(pcService.updatePCAsDm).not.toHaveBeenCalled(); // never PUTs the sheet's own copy
      const [id, mutate, describe] = grantService.grantToPc.calls.mostRecent().args;
      expect(id).toBe(7);

      // The player took the shield off between the sheet loading and the DM saving.
      const fresh = armoured({
        ac: 15,
        inventory: [{ name: 'Chain Shirt', category: 'armor', qty: 1, equipped: true, armorClass: '13 + Dex modifier (max 2)' }],
      });
      const updated = mutate(fresh);
      expect(updated.ac).toBe(16);                         // 13 + 2 + Taunka 1, shield still off
      expect(updated.statAdjustments).toEqual({ ac: [taunka] });
      expect(fresh.ac).toBe(15);                           // pure
      expect(describe!(fresh, updated)).toBe('DM added +1 Taunka to AC (AC 15 → 16)');
    });

    it('opens with a removed calculated line marked, and the saved total as it is', () => {
      component.pc = armoured({ ac: 15, statAdjustments: { acRemoved: [{ value: 1, label: 'Dexterity' }] } });

      component.onBreakdownRequested('ac');

      expect(component.statBreakdown?.auto.map(l => !!l.removed)).toEqual([false, true, false]);
      expect(component.statBreakdown?.removed).toEqual(['Dexterity']);
      expect(component.statBreakdown?.unlabelled).toBe(0);
      expect(component.statBreakdown?.total).toBe(15);
    });

    it('saves a removed calculated line on the FRESH character and logs it in plain words', () => {
      grantService.grantToPc.and.returnValue(of(makePC()));
      component.pc = armoured();
      component.editable = true;
      component.onBreakdownRequested('ac');

      component.onStatAdjustmentsSaved({ lines: [], keepUnlabelled: true, removed: ['Dexterity'], fromBase: 0 });

      const [, mutate, describe] = grantService.grantToPc.calls.mostRecent().args;
      const fresh = armoured();
      const updated = mutate(fresh);
      expect(updated.ac).toBe(15);                          // 17 less the Dexterity line's 2
      expect(updated.statAdjustments).toEqual({ ac: [], acRemoved: [{ value: 1, label: 'Dexterity' }] });
      expect(fresh.ac).toBe(17);                            // pure
      expect(describe!(fresh, updated)).toBe('DM removed the calculated Dexterity line from AC (AC 17 → 15)');

      // Restoring it is the same save the other way round.
      component.onBreakdownRequested('ac');
      component.onStatAdjustmentsSaved({ lines: [], keepUnlabelled: true, removed: [], fromBase: 0 });
      const [, undo, describeUndo] = grantService.grantToPc.calls.mostRecent().args;
      const restored = undo(updated);
      expect(restored.ac).toBe(17);
      expect(describeUndo!(updated, restored)).toBe('DM restored the calculated Dexterity line on AC (AC 15 → 17)');
    });

    it('tells the DM when the save fails', () => {
      const error = new Error('network down');
      grantService.grantToPc.and.returnValue(throwError(() => error));
      const notify = spyOn(TestBed.inject(NotificationService), 'error');
      component.pc = armoured();
      component.editable = true;
      component.onBreakdownRequested('ac');

      component.onStatAdjustmentsSaved({ lines: [taunka], keepUnlabelled: true, removed: [], fromBase: 0 });

      expect(notify).toHaveBeenCalledWith('Could not save the adjustments. Try again.', error);
    });

    it('saves the owner of a campaign-less character through the owner path', () => {
      pcService.updatePC.and.returnValue(of(makePC()));
      component.pc = armoured({ campaignId: null });
      component.showActions = true;
      component.onBreakdownRequested('ac');

      component.onStatAdjustmentsSaved({ lines: [taunka], keepUnlabelled: true, removed: [], fromBase: 0 });

      expect(grantService.grantToPc).not.toHaveBeenCalled();
      expect(pcService.updatePC).toHaveBeenCalledWith(
        jasmine.objectContaining({ ac: 18, statAdjustments: { ac: [taunka] } }));
    });

    it('ignores a save from a viewer who may not adjust', () => {
      component.pc = armoured();
      component.showActions = true; // a player in a campaign
      component.onBreakdownRequested('ac');

      component.onStatAdjustmentsSaved({ lines: [taunka], keepUnlabelled: true, removed: [], fromBase: 0 });

      expect(grantService.grantToPc).not.toHaveBeenCalled();
      expect(pcService.updatePC).not.toHaveBeenCalled();
      expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
    });

    it('closing drops the dialog without saving', () => {
      component.pc = armoured();
      component.onBreakdownRequested('ac');
      component.closeStatBreakdown();
      expect(component.statBreakdown).toBeNull();
      expect(grantService.grantToPc).not.toHaveBeenCalled();
    });
  });

  // --- Ability score breakdown ---

  describe('ability score breakdown', () => {
    const level4 = { value: 1, label: 'Level 4 Increase' };
    /** STR 17 with nothing recorded; DEX 14 unarmored, so AC 12. */
    const hero = (overrides: Partial<PC> = {}): PC => makePC({
      stats: { STR: 17, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
      hp: { cur: 30, max: 38, temp: 0 },
      ac: 12,
      campaignId: 3,
      ...overrides,
    });

    it('opens with a base score and the recorded lines, for any viewer', () => {
      component.pc = hero({ statAdjustments: { STR: [{ value: 2, label: 'Soldier' }, level4] } });

      component.onBreakdownRequested('STR');

      expect(component.statBreakdown?.stat).toBe('STR');
      expect(component.statBreakdown?.auto).toEqual([{ label: 'Base score', value: 14 }]);
      expect(component.statBreakdown?.adjustments).toEqual([{ value: 2, label: 'Soldier' }, level4]);
      expect(component.statBreakdown?.unlabelled).toBe(0);
      expect(component.statBreakdown?.total).toBe(17);
    });

    it('saves a DM line on the FRESH character: the score rises and the log says why', () => {
      grantService.grantToPc.and.returnValue(of(makePC()));
      component.pc = hero();
      component.editable = true;
      component.onBreakdownRequested('STR');

      component.onStatAdjustmentsSaved({ lines: [level4], keepUnlabelled: true, removed: [], fromBase: 0 });

      const [id, mutate, describe] = grantService.grantToPc.calls.mostRecent().args;
      expect(id).toBe(7);
      const fresh = hero({ stats: { STR: 18, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 } }); // changed meanwhile
      const updated = mutate(fresh);
      expect(updated.stats?.STR).toBe(19);
      expect(updated.statAdjustments).toEqual({ STR: [level4] });
      expect(fresh.stats?.STR).toBe(18); // pure
      expect(describe!(fresh, updated)).toBe('DM added +1 Level 4 Increase to STR (STR 18 → 19)');
    });

    it('labels part of the base without moving the score', () => {
      grantService.grantToPc.and.returnValue(of(makePC()));
      component.pc = hero();
      component.editable = true;
      component.onBreakdownRequested('STR');

      component.onStatAdjustmentsSaved({ lines: [level4], keepUnlabelled: true, removed: [], fromBase: 1 });

      const [, mutate, describe] = grantService.grantToPc.calls.mostRecent().args;
      const fresh = hero();
      const updated = mutate(fresh);
      expect(updated.stats?.STR).toBe(17);
      expect(updated.statAdjustments).toEqual({ STR: [level4] });
      expect(describe!(fresh, updated)).toBe('DM labelled +1 of the STR base score as Level 4 Increase');
    });

    it('a Dexterity line brings Armor Class along and says so in the log', () => {
      grantService.grantToPc.and.returnValue(of(makePC()));
      component.pc = hero();
      component.editable = true;
      component.onBreakdownRequested('DEX');
      const gloves = { value: 2, label: 'Gloves of Dexterity' };

      component.onStatAdjustmentsSaved({ lines: [gloves], keepUnlabelled: true, removed: [], fromBase: 0 });

      const [, mutate, describe] = grantService.grantToPc.calls.mostRecent().args;
      const fresh = hero();
      const updated = mutate(fresh);
      expect(updated.stats?.DEX).toBe(16);
      expect(updated.ac).toBe(13);
      expect(describe!(fresh, updated)).toBe('DM added +2 Gloves of Dexterity to DEX (DEX 14 → 16); AC 12 → 13');
    });

    it('a Constitution line leaves hit points as they are', () => {
      grantService.grantToPc.and.returnValue(of(makePC()));
      component.pc = hero();
      component.editable = true;
      component.onBreakdownRequested('CON');

      component.onStatAdjustmentsSaved({
        lines: [{ value: 2, label: 'Amulet of Health' }], keepUnlabelled: true, removed: [], fromBase: 0,
      });

      const [, mutate] = grantService.grantToPc.calls.mostRecent().args;
      const updated = mutate(hero());
      expect(updated.stats?.CON).toBe(16);
      expect(updated.hp).toEqual({ cur: 30, max: 38, temp: 0 });
    });

    it('saves the owner of a campaign-less character through the owner path', () => {
      pcService.updatePC.and.returnValue(of(makePC()));
      component.pc = hero({ campaignId: null });
      component.showActions = true;
      component.onBreakdownRequested('STR');

      component.onStatAdjustmentsSaved({ lines: [level4], keepUnlabelled: true, removed: [], fromBase: 0 });

      expect(grantService.grantToPc).not.toHaveBeenCalled();
      expect(pcService.updatePC).toHaveBeenCalledWith(jasmine.objectContaining({
        stats: { STR: 18, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
        statAdjustments: { STR: [level4] },
      }));
    });

    it('ignores a save from a player in a campaign', () => {
      component.pc = hero();
      component.showActions = true;
      component.onBreakdownRequested('STR');

      component.onStatAdjustmentsSaved({ lines: [level4], keepUnlabelled: true, removed: [], fromBase: 0 });

      expect(grantService.grantToPc).not.toHaveBeenCalled();
      expect(pcService.updatePC).not.toHaveBeenCalled();
    });
  });

  // --- DM feature grants ---

  // --- Spell slots: spend by hand, restore, the slot maximum ---

  describe('spell slots', () => {
    const SLOTS = { 1: { max: 4, used: 1 }, 2: { max: 3, used: 3 }, 3: { max: 2, used: 0 } };
    const caster = (overrides: Partial<PC> = {}): PC =>
      makePC({ clazz: 'Wizard', level: 5, campaignId: 3, spellSlots: SLOTS, ...overrides });
    /** A caster in no campaign: no DM, so its owner spends and restores by hand. */
    const solo = (overrides: Partial<PC> = {}): PC => caster({ campaignId: null, ...overrides });
    /** The viewer is the character's owner, on their own interactive sheet. */
    const asOwner = (pc: PC): void => { component.pc = pc; component.showActions = true; };
    /** The viewer is the campaign's DM, on the cross-link view of a member. */
    const asDm = (pc: PC): void => { component.pc = pc; component.editable = true; };

    describe('who may do what', () => {
      it('a player in a campaign may neither spend by hand nor restore: they cast in a session', () => {
        asOwner(caster());
        expect(component.canSpendSlots).toBeFalse();
        expect(component.canRestoreSlots).toBeFalse();
      });

      it('the owner of a character in no campaign may restore their own: there is no DM to ask', () => {
        asOwner(caster({ campaignId: null }));
        expect(component.canSpendSlots).toBeTrue();
        expect(component.canRestoreSlots).toBeTrue();
        asOwner(caster({ campaignId: undefined }));
        expect(component.canRestoreSlots).toBeTrue();
      });

      it('the same holds on the sheet embedded in a live session, where the Cast button spends the slot', () => {
        component.pc = caster();
        component.showActions = false;
        component.inventoryEditable = true;
        component.sessionLive = true;
        expect(component.canSpendSlots).toBeFalse();
        expect(component.canRestoreSlots).toBeFalse();
        expect(component.slotMaximumAccess).toBe('hidden');
      });

      it('the DM may spend on the player\'s behalf and restore', () => {
        asDm(caster());
        expect(component.canSpendSlots).toBeTrue();
        expect(component.canRestoreSlots).toBeTrue();
      });

      it('a read-only viewer may do neither', () => {
        component.pc = caster();
        component.showActions = false;
        expect(component.canSpendSlots).toBeFalse();
        expect(component.canRestoreSlots).toBeFalse();
      });

      it('whoever may adjust the character changes a slot maximum, as with Armor Class; a campaign player gets no button', () => {
        asOwner(caster());
        expect(component.slotMaximumAccess).toBe('hidden');
        asOwner(caster({ campaignId: null }));
        expect(component.slotMaximumAccess).toBe('edit');
        asDm(caster());
        expect(component.slotMaximumAccess).toBe('edit');
      });

      it('a viewer who does not own the character may still look at a slot maximum', () => {
        component.pc = caster();
        component.showActions = false;
        expect(component.slotMaximumAccess).toBe('view');
      });

      it('ignores a request the viewer may not make', () => {
        component.pc = caster();
        component.showActions = false;

        component.onSlotSpend(1);
        component.onSlotRestore(1);
        component.onSlotsRestoreAll();
        asOwner(caster());                 // a campaign player: none of the three
        component.onSlotSpend(1);
        component.onSlotRestore(1);
        component.onSlotsRestoreAll();

        expect(pcService.spendSpellSlot).not.toHaveBeenCalled();
        expect(pcService.restoreSpellSlot).not.toHaveBeenCalled();
        expect(pcService.restoreAllSpellSlots).not.toHaveBeenCalled();
      });
    });

    describe('spending and restoring', () => {
      const AFTER = { ...SLOTS, 1: { max: 4, used: 2 } };

      it('spends through the spend endpoint, never a sheet save, and says so on the strip', () => {
        pcService.spendSpellSlot.and.returnValue(of(AFTER));
        asOwner(solo());

        component.onSlotSpend(1);

        expect(pcService.spendSpellSlot).toHaveBeenCalledOnceWith(7, 1, false);
        expect(pcService.updatePC).not.toHaveBeenCalled();
        expect(component.slotNotice()).toEqual({ level: 1, text: 'One 1st-level slot spent by hand.' });
        expect(component.slotsBusy()).toBeFalse();
      });

      it('hands the answered slots to the live session, so the embedded sheet shows them at once', () => {
        pcService.spendSpellSlot.and.returnValue(of(AFTER));
        asDm(caster());

        component.onSlotSpend(1);

        expect(sessionService.applySpellSlots).toHaveBeenCalledOnceWith(7, AFTER);
      });

      it('the DM spends and restores as the DM', () => {
        pcService.spendSpellSlot.and.returnValue(of(AFTER));
        pcService.restoreSpellSlot.and.returnValue(of(SLOTS));
        pcService.restoreAllSpellSlots.and.returnValue(of(SLOTS));
        asDm(caster());

        component.onSlotSpend(1);
        component.onSlotRestore(2);
        expect(component.slotNotice()).toEqual({ level: 2, text: 'One 2nd-level slot restored.' });
        component.onSlotsRestoreAll();
        expect(component.slotNotice()).toEqual({ level: null, text: 'All slots restored.' });

        expect(pcService.spendSpellSlot).toHaveBeenCalledOnceWith(7, 1, true);
        expect(pcService.restoreSpellSlot).toHaveBeenCalledOnceWith(7, 2, true);
        expect(pcService.restoreAllSpellSlots).toHaveBeenCalledOnceWith(7, true);
      });

      it('holds a second request while the first is still on its way', () => {
        const pending = new Subject<typeof SLOTS>();
        pcService.spendSpellSlot.and.returnValue(pending);
        asOwner(solo());

        component.onSlotSpend(1);
        expect(component.slotsBusy()).toBeTrue();
        component.onSlotSpend(1);
        expect(pcService.spendSpellSlot).toHaveBeenCalledTimes(1);
        expect(component.slotNotice()).toBeNull(); // nothing is said before the server answers

        pending.next(AFTER);
        expect(component.slotsBusy()).toBeFalse();
        expect(component.slotNotice()).not.toBeNull();
      });

      it('on a refusal says why, says nothing on the strip, and reads the slots again', () => {
        const conflict = { status: 409, error: { message: 'No level 2 slot available' } };
        pcService.spendSpellSlot.and.returnValue(throwError(() => conflict));
        const notify = spyOn(TestBed.inject(NotificationService), 'error');
        asOwner(solo());

        component.onSlotSpend(2);

        expect(notify).toHaveBeenCalledWith('Could not spend that slot. Try again.', conflict);
        expect(component.slotNotice()).toBeNull();
        expect(component.slotsBusy()).toBeFalse();
        expect(sessionService.applySpellSlots).not.toHaveBeenCalled();
        expect(pcService.refreshSpellSlots).toHaveBeenCalledOnceWith(7, false);
        expect(sessionService.refresh).not.toHaveBeenCalled(); // not embedded in a session
      });

      it('a failed restore re-reads through the DM path for the DM', () => {
        pcService.restoreSpellSlot.and.returnValue(throwError(() => new Error('offline')));
        pcService.restoreAllSpellSlots.and.returnValue(throwError(() => new Error('offline')));
        const notify = spyOn(TestBed.inject(NotificationService), 'error');
        asDm(caster());

        component.onSlotRestore(2);
        component.onSlotsRestoreAll();

        expect(notify.calls.allArgs().map(args => args[0])).toEqual(
          ['Could not restore that slot. Try again.', 'Could not restore the slots. Try again.']);
        expect(pcService.refreshSpellSlots.calls.allArgs()).toEqual([[7, true], [7, true]]);
        expect(sessionService.refresh).not.toHaveBeenCalled(); // not embedded in a session
      });

      it('forgets what it said when a different character takes over the sheet', () => {
        pcService.spendSpellSlot.and.returnValue(of(AFTER));
        asOwner(solo());
        component.onSlotSpend(1);
        const previous = component.pc;

        component.pc = solo({ id: 8 });
        component.ngOnChanges({ pc: new SimpleChange(previous, component.pc, false) });
        expect(component.slotNotice()).toBeNull();
      });

      it('keeps what it said through a refresh of the same character', () => {
        pcService.spendSpellSlot.and.returnValue(of(AFTER));
        asOwner(solo());
        component.onSlotSpend(1);
        const previous = component.pc;

        component.pc = solo({ spellSlots: AFTER });
        component.ngOnChanges({ pc: new SimpleChange(previous, component.pc, false) });
        expect(component.slotNotice()).not.toBeNull();
      });
    });

    describe('a cast in the session', () => {
      it('passes on what the host says the cast spent, for the strip to say', () => {
        component.pc = caster();
        const notice = { level: 2, text: 'Misty Step cast with a 2nd-level slot.' };

        component.castNotice = notice;
        expect(component.slotNotice()).toBe(notice);

        component.castNotice = null; // the host's signal before any cast: nothing to say, nothing unsaid
        expect(component.slotNotice()).toBe(notice);
      });
    });

    describe('the slot maximum', () => {
      const pearl = { value: 1, label: 'Pearl of Power' };

      it('opens the same breakdown as Armor Class, for the spell level asked about', () => {
        asOwner(caster({ spellSlots: { ...SLOTS, 3: { max: 3, used: 0 } }, statAdjustments: { slot3: [pearl] } }));

        component.onSlotMaximumRequested(3);

        expect(component.statBreakdown?.stat).toBe('slot3');
        expect(component.statBreakdown?.auto).toEqual([{ label: 'Class table', value: 2 }]);
        expect(component.statBreakdown?.adjustments).toEqual([pearl]);
        expect(component.statBreakdown?.total).toBe(3);
        expect(component.dmEdit).toBeNull();
      });

      it('saves a DM line through the same refetch-merge-save path as Armor Class, on the FRESH character', () => {
        grantService.grantToPc.and.returnValue(of(makePC()));
        asDm(caster());
        component.onSlotMaximumRequested(3);

        component.onStatAdjustmentsSaved({ lines: [pearl], keepUnlabelled: true, removed: [], fromBase: 0 });

        expect(component.statBreakdown).toBeNull();
        expect(pcService.updatePCAsDm).not.toHaveBeenCalled();
        const [id, mutate, describe] = grantService.grantToPc.calls.mostRecent().args;
        expect(id).toBe(7);

        // The player cast a 3rd-level spell between the sheet loading and the DM saving.
        const fresh = caster({ spellSlots: { ...SLOTS, 3: { max: 2, used: 1 } } });
        const updated = mutate(fresh);
        expect(updated.statAdjustments).toEqual({ slot3: [pearl] });
        expect(updated.spellSlots![3]).toEqual({ max: 3, used: 1 }); // one more slot, the cast still spent
        expect(fresh.spellSlots![3]).toEqual({ max: 2, used: 1 });   // pure
        expect(describe!(fresh, updated)).toBe('DM added +1 Pearl of Power to 3rd-level slots (3rd-level slots 2 → 3)');
      });

      it('saves the owner of a campaign-less character through the owner path', () => {
        pcService.updatePC.and.returnValue(of(makePC()));
        asOwner(caster({ campaignId: null }));
        component.onSlotMaximumRequested(1);

        component.onStatAdjustmentsSaved({ lines: [pearl], keepUnlabelled: true, removed: [], fromBase: 0 });

        expect(grantService.grantToPc).not.toHaveBeenCalled();
        expect(pcService.updatePC).toHaveBeenCalledWith(jasmine.objectContaining({
          statAdjustments: { slot1: [pearl] },
          spellSlots: { ...SLOTS, 1: { max: 5, used: 1 } },
        }));
      });

      it('a player in a campaign may look but a save from them is ignored', () => {
        asOwner(caster());
        component.onSlotMaximumRequested(1);
        expect(component.statBreakdown).not.toBeNull();

        component.onStatAdjustmentsSaved({ lines: [pearl], keepUnlabelled: true, removed: [], fromBase: 0 });

        expect(grantService.grantToPc).not.toHaveBeenCalled();
        expect(pcService.updatePC).not.toHaveBeenCalled();
      });
    });
  });

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

  it('grants a batch in one save — stacking onto owned lines and onto earlier lines of the same batch', () => {
    grantService.grantToPc.and.returnValue(of(makePC()));
    const batch: PcItem[] = [
      { catalogKey: 'rations', name: 'Rations', category: 'gear', qty: 5 },
      { name: 'Cracked Fang', category: 'gear', qty: 1 },
      { catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1 },
      { catalogKey: 'rations', name: 'Rations', category: 'gear', qty: 2 },
    ];
    component.onItemsGrant(batch);

    expect(grantService.grantToPc).toHaveBeenCalledTimes(1);
    const mutate = grantService.grantToPc.calls.mostRecent().args[1];
    const fresh: PC = makePC({ inventory: [{ catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 1 }] });

    expect(mutate(fresh).inventory).toEqual([
      { catalogKey: 'longsword', name: 'Longsword', category: 'weapon', qty: 2 },
      { catalogKey: 'rations', name: 'Rations', category: 'gear', qty: 7 },
      { name: 'Cracked Fang', category: 'gear', qty: 1 },
    ]);
    // Purity: neither the fresh PC nor the emitted batch is mutated.
    expect(fresh.inventory![0].qty).toBe(1);
    expect(batch[0].qty).toBe(5);
  });

  it('an empty batch saves nothing', () => {
    component.onItemsGrant([]);
    expect(grantService.grantToPc).not.toHaveBeenCalled();
  });

  it('tells the user if a batch grant fails', () => {
    const error = new Error('network down');
    grantService.grantToPc.and.returnValue(throwError(() => error));
    const notify = spyOn(TestBed.inject(NotificationService), 'error');

    component.onItemsGrant([
      { name: 'Rope', category: 'gear', qty: 1 }, { name: 'Torch', category: 'gear', qty: 3 },
    ]);

    expect(notify).toHaveBeenCalledWith('Could not grant the items. Try again.', error);
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

    // The Party Vitals Board asks for a follower through UiState; the sheet
    // for that character claims the request when the character reaches it.
    describe('requested from outside the sheet', () => {
      const arrive = () => component.ngOnChanges({ pc: new SimpleChange(undefined, component.pc, true) });

      afterEach(() => uiState.takeFollowerRequest(7));

      it('opens the requested follower of this character', () => {
        followerService.list.and.returnValue(of([brannoc()]));
        uiState.requestFollower(7, 12);

        arrive();

        expect(followerService.list).toHaveBeenCalledOnceWith(7);
        expect(uiState.followerRequest()).toBeNull();
        expect(uiState.openFollowerId()).toBe(12);
        expect(component.openFollowerPc()).toEqual(jasmine.objectContaining({ id: -12, name: 'Brannoc' }));
      });

      it("leaves another character's request alone", () => {
        uiState.requestFollower(99, 12);

        arrive();

        expect(followerService.list).not.toHaveBeenCalled();
        expect(uiState.followerRequest()).toEqual({ pcId: 99, followerId: 12 });
        uiState.takeFollowerRequest(99);
      });

      it('says so when the follower is gone, and stays on the character', () => {
        const notifications = TestBed.inject(NotificationService);
        const error = spyOn(notifications, 'error');
        followerService.list.and.returnValue(of([]));
        uiState.requestFollower(7, 12);

        arrive();

        expect(component.openFollowerPc()).toBeNull();
        expect(uiState.openFollowerId()).toBeNull();
        expect(error).toHaveBeenCalled();
      });

      it('a follower sheet never claims a request', () => {
        component.followerMode = true;
        uiState.requestFollower(7, 12);

        arrive();

        expect(followerService.list).not.toHaveBeenCalled();
      });
    });

    // The DM damaged or dismissed the follower while its sheet is open here.
    describe('changed somewhere else while open', () => {
      beforeEach(() => component.onFollowerOpened(brannoc()));

      it("shows the server's copy", () => {
        followerService.list.and.returnValue(of([{ ...brannoc(), statBlock: { clazz: 'Guard', level: 2, ac: 12 } }]));

        followerChanges.next({ pcId: 7 });

        expect(followerService.list).toHaveBeenCalledOnceWith(7);
        expect(component.openFollowerPc()?.ac).toBe(12);
      });

      it("ignores another character's followers", () => {
        followerChanges.next({ pcId: 8 });

        expect(followerService.list).not.toHaveBeenCalled();
      });

      it('never re-lists over a save of its own that is still in flight', () => {
        const save = new Subject<Follower>();
        followerService.update.and.returnValue(save);
        component.onFollowerChanged({ ...component.openFollowerPc()!, ac: 18 });

        followerChanges.next({ pcId: 7 });

        expect(followerService.list).not.toHaveBeenCalled();
        expect(component.openFollowerPc()?.ac).toBe(18);
      });

      it('drops a re-list that an edit overtook', () => {
        const listing = new Subject<Follower[]>();
        followerService.list.and.returnValue(listing);
        followerService.update.and.returnValue(of(brannoc()));
        followerChanges.next({ pcId: 7 });

        component.onFollowerChanged({ ...component.openFollowerPc()!, ac: 18 });
        listing.next([brannoc()]);   // the stale copy, AC 16

        expect(component.openFollowerPc()?.ac).toBe(18);
      });

      it('closes the sheet of a follower who was dismissed', () => {
        const notifications = TestBed.inject(NotificationService);
        const notify = spyOn(notifications, 'notify');
        followerService.list.and.returnValue(of([]));

        followerChanges.next({ pcId: 7 });

        expect(component.openFollowerPc()).toBeNull();
        expect(uiState.openFollowerId()).toBeNull();
        expect(notify).toHaveBeenCalledWith('Brannoc is no longer with Throk.');
      });
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

    // A follower is not a character row: no spend / restore endpoint, no adjustment
    // lines. Its slots are stat-block data, changed by the same rules and saved locally.
    describe('spell slots', () => {
      const SLOTS = { 1: { max: 2, used: 1 } };

      beforeEach(() => {
        component.pc = makePC({ id: -12, name: 'Brannoc', clazz: 'Guard', level: 2, spellSlots: SLOTS });
        component.inventoryEditable = true; // the owner's interactive follower sheet
      });

      it('the owner spends by hand, saved with the stat block and never through the PC endpoints', () => {
        component.onSlotSpend(1);

        expect(changed).toHaveBeenCalledOnceWith(jasmine.objectContaining({ id: -12, spellSlots: { 1: { max: 2, used: 2 } } }));
        expect(pcService.spendSpellSlot).not.toHaveBeenCalled();
        expect(component.slotNotice()).toEqual({ level: 1, text: 'One 1st-level slot spent by hand.' });
      });

      it('says so when there is no slot left to spend, and saves nothing', () => {
        const notify = spyOn(TestBed.inject(NotificationService), 'notify');
        component.pc = makePC({ id: -12, spellSlots: { 1: { max: 2, used: 2 } } });

        component.onSlotSpend(1);

        expect(notify).toHaveBeenCalledWith('No 1st-level slot is left to spend.');
        expect(changed).not.toHaveBeenCalled();
        expect(component.slotNotice()).toBeNull();
      });

      it('the owner of a campaign character neither spends nor restores their follower\'s slots by hand', () => {
        component.followerOwnerInCampaign = true;
        expect(component.canSpendSlots).toBeFalse();
        expect(component.canRestoreSlots).toBeFalse();
        expect(component.slotMaximumAccess).toBe('hidden');

        component.onSlotSpend(1);
        component.onSlotRestore(1);
        component.onSlotsRestoreAll();
        expect(changed).not.toHaveBeenCalled();
      });

      it('the campaign\'s DM still spends a follower\'s slot by hand', () => {
        component.inventoryEditable = false;
        component.editable = true;
        component.followerOwnerInCampaign = true;
        expect(component.canSpendSlots).toBeTrue();

        component.onSlotSpend(1);
        expect(changed).toHaveBeenCalledOnceWith(jasmine.objectContaining({ spellSlots: { 1: { max: 2, used: 2 } } }));
      });

      it('with no campaign, and so no DM, the owner restores them', () => {
        component.followerOwnerInCampaign = false;
        expect(component.canRestoreSlots).toBeTrue();

        component.onSlotRestore(1);
        expect(changed).toHaveBeenCalledOnceWith(jasmine.objectContaining({ spellSlots: { 1: { max: 2, used: 0 } } }));
        expect(component.slotNotice()).toEqual({ level: 1, text: 'One 1st-level slot restored.' });
        expect(pcService.restoreSpellSlot).not.toHaveBeenCalled();
      });

      it('the DM restores everything at once', () => {
        component.inventoryEditable = false;
        component.editable = true;
        component.followerOwnerInCampaign = true;

        component.onSlotsRestoreAll();

        expect(changed).toHaveBeenCalledOnceWith(jasmine.objectContaining({ spellSlots: { 1: { max: 2, used: 0 } } }));
        expect(component.slotNotice()).toEqual({ level: null, text: 'All slots restored.' });
      });

      it('has no breakdown: the owner gets no "Slot maximum", the DM types the number', () => {
        expect(component.slotMaximumAccess).toBe('hidden');
        component.onSlotMaximumRequested(1);
        expect(component.statBreakdown).toBeNull();
        expect(component.dmEdit).toBeNull();

        component.editable = true;
        expect(component.slotMaximumAccess).toBe('edit');
        component.onSlotMaximumRequested(1);
        expect(component.statBreakdown).toBeNull();
        expect(component.dmEdit).toEqual(jasmine.objectContaining({ label: '1st-level slot maximum', value: 2, min: 1 }));

        component.onDmEditConfirmed({ value: 1, description: null });
        expect(changed).toHaveBeenCalledOnceWith(jasmine.objectContaining({ spellSlots: { 1: { max: 1, used: 1 } } }));
      });
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

    it('a pet family change is plain stat-block data, not the PC pet endpoint', () => {
      component.onPetFamilyChange('Wolf');

      expect(changed).toHaveBeenCalledWith(jasmine.objectContaining({ id: -12, petFamily: 'Wolf' }));
      expect(pcService.setPetFamily).not.toHaveBeenCalled();
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
