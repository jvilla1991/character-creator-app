import { Subject, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';

import { CharacterSheetComponent } from './character-sheet.component';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { SessionService } from '../../services/session.service';
import { FollowerService } from '../../services/follower.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { PC } from '../../models/pc';

/**
 * Mystic Focus on the sheet: who gets the block under the slot strip (the
 * owner, in a campaign or not, and the DM) and what a confirmed conversion
 * does (its own endpoint, never a sheet save).
 */
describe('CharacterSheetComponent (Mystic Focus)', () => {
  const SLOTS = { 1: { max: 4, used: 1 }, 2: { max: 2, used: 1 } };
  const AFTER = { 1: { max: 4, used: 1 }, 2: { max: 2, used: 2 } };

  let component: CharacterSheetComponent;
  let pcService: jasmine.SpyObj<PCService>;
  let sessionService: jasmine.SpyObj<SessionService>;

  const monk = (overrides: Partial<PC> = {}): PC => ({
    id: 7, name: 'Shen', clazz: 'Monk', subclass: 'Warrior of the Mystic Arts', level: 8, playerName: 'Sam',
    campaignId: 3, spellSlots: SLOTS, classResources: { focusPoints: 5 }, ...overrides,
  });
  /** The viewer is the character's owner, on their own interactive sheet. */
  const asOwner = (pc: PC): void => { component.pc = pc; component.showActions = true; };
  /** The viewer is the campaign's DM, on the cross-link view of a member. */
  const asDm = (pc: PC): void => { component.pc = pc; component.editable = true; };

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['updatePC', 'updatePCAsDm', 'mysticFocus', 'refreshSpellSlots']);
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['refresh', 'applySpellSlots']);
    const followerService = jasmine.createSpyObj<FollowerService>('FollowerService', ['update', 'list'],
      { changes$: new Subject<{ pcId: number }>() });
    component = TestBed.runInInjectionContext(() => new CharacterSheetComponent(
      pcService, jasmine.createSpyObj<GrantService>('GrantService', ['grantToPc']), sessionService, followerService,
      TestBed.inject(UiStateService)));
  });

  describe('who gets it', () => {
    it('the owner, in a campaign or not: it is the player\'s own feature', () => {
      asOwner(monk());
      expect(component.canUseMysticFocus).toBeTrue();
      // Unlike spending a slot by hand, which a campaign player may not do.
      expect(component.canSpendSlots).toBeFalse();
      asOwner(monk({ campaignId: null }));
      expect(component.canUseMysticFocus).toBeTrue();
    });

    it('the owner on the sheet embedded in a live session', () => {
      component.pc = monk();
      component.showActions = false;
      component.inventoryEditable = true;
      component.sessionLive = true;
      expect(component.canUseMysticFocus).toBeTrue();
    });

    it('the DM', () => {
      asDm(monk());
      expect(component.canUseMysticFocus).toBeTrue();
    });

    it('not a read-only viewer, and not a follower\'s sheet', () => {
      component.pc = monk();
      component.showActions = false;
      expect(component.canUseMysticFocus).toBeFalse();

      asOwner(monk());
      component.followerMode = true;
      expect(component.canUseMysticFocus).toBeFalse();
    });

    it('ignores a conversion the viewer may not make', () => {
      component.pc = monk();
      component.showActions = false;

      component.onMysticFocus({ action: 'SLOT_TO_FOCUS', slotLevel: 1 });

      expect(pcService.mysticFocus).not.toHaveBeenCalled();
    });
  });

  describe('a confirmed conversion', () => {
    it('goes to the Mystic Focus endpoint, never a sheet save, and says so on the strip', () => {
      pcService.mysticFocus.and.returnValue(of(monk({ spellSlots: AFTER, classResources: { focusPoints: 3 } })));
      asOwner(monk());

      component.onMysticFocus({ action: 'SLOT_TO_FOCUS', slotLevel: 2 });

      expect(pcService.mysticFocus).toHaveBeenCalledOnceWith(7, 'SLOT_TO_FOCUS', 2, false);
      expect(pcService.updatePC).not.toHaveBeenCalled();
      expect(component.slotNotice()).toEqual({ level: 2, text: 'One 2nd-level slot turned into Focus Points.' });
      expect(component.mysticFocusBusy()).toBeFalse();
    });

    it('hands the saved slots to the live session, so the embedded sheet shows them at once', () => {
      pcService.mysticFocus.and.returnValue(of(monk({ spellSlots: AFTER })));
      asOwner(monk());

      component.onMysticFocus({ action: 'SLOT_TO_FOCUS', slotLevel: 2 });

      expect(sessionService.applySpellSlots).toHaveBeenCalledOnceWith(7, AFTER);
    });

    it('the DM converts as the DM', () => {
      pcService.mysticFocus.and.returnValue(of(monk()));
      asDm(monk());

      component.onMysticFocus({ action: 'FOCUS_TO_SLOT', slotLevel: 1 });

      expect(pcService.mysticFocus).toHaveBeenCalledOnceWith(7, 'FOCUS_TO_SLOT', 1, true);
      expect(component.slotNotice()).toEqual({ level: 1, text: 'One 1st-level slot recovered with Focus Points.' });
    });

    it('holds a second request while the first is still on its way', () => {
      const pending = new Subject<PC>();
      pcService.mysticFocus.and.returnValue(pending);
      asOwner(monk());

      component.onMysticFocus({ action: 'SLOT_TO_FOCUS', slotLevel: 1 });
      expect(component.mysticFocusBusy()).toBeTrue();
      component.onMysticFocus({ action: 'SLOT_TO_FOCUS', slotLevel: 1 });
      expect(pcService.mysticFocus).toHaveBeenCalledTimes(1);
      expect(component.slotNotice()).toBeNull(); // nothing is said before the server answers

      pending.next(monk());
      expect(component.mysticFocusBusy()).toBeFalse();
      expect(component.slotNotice()).not.toBeNull();
    });

    it('on a refusal says why, says nothing on the strip, and reads the slots again', () => {
      const conflict = { status: 409, error: { message: 'No expended Focus Points to regain' } };
      pcService.mysticFocus.and.returnValue(throwError(() => conflict));
      const notify = spyOn(TestBed.inject(NotificationService), 'error');
      asOwner(monk());

      component.onMysticFocus({ action: 'SLOT_TO_FOCUS', slotLevel: 1 });

      expect(notify).toHaveBeenCalledWith('Could not use Mystic Focus. Try again.', conflict);
      expect(component.slotNotice()).toBeNull();
      expect(component.mysticFocusBusy()).toBeFalse();
      expect(sessionService.applySpellSlots).not.toHaveBeenCalled();
      expect(pcService.refreshSpellSlots).toHaveBeenCalledOnceWith(7, false);
      expect(sessionService.refresh).not.toHaveBeenCalled(); // not embedded in a session
    });

    it('a refusal inside a live session also reads the session again', () => {
      pcService.mysticFocus.and.returnValue(throwError(() => new Error('offline')));
      spyOn(TestBed.inject(NotificationService), 'error');
      component.pc = monk();
      component.showActions = false;
      component.inventoryEditable = true;
      component.sessionLive = true;

      component.onMysticFocus({ action: 'FOCUS_TO_SLOT', slotLevel: 2 });

      expect(sessionService.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
