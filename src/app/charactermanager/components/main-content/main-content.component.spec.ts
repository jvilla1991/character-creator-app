import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { LEVEL_WATCH_MS, MainContentComponent } from './main-content.component';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { CharacterModalService } from '../../services/character-modal.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { CampaignService } from '../../services/campaign.service';
import { JoinModalService } from '../../services/join-modal.service';
import { DiceRollerService } from '../../services/dice-roller.service';
import { LEVEL_UP_ANSWERED_KEY, LevelUpPromptService } from '../../services/level-up-prompt.service';

/** Just the PCService surface main-content touches, with grantLevelUp re-emitting like the real one. */
class PcServiceStub {
  readonly active = new BehaviorSubject<PC | null>(null);
  roster: PC[] = [];
  readonly refreshPC = jasmine.createSpy('refreshPC');
  readonly syncLevelState = jasmine.createSpy('syncLevelState').and.returnValue(of(undefined));
  getActivePC(): Observable<PC | null> { return this.active.asObservable(); }
  getPCById(id: number): PC | undefined { return this.roster.find(p => p.id === id); }
  grantLevelUp(_id: number, granted: boolean): Observable<PC> {
    const next = { ...this.active.getValue()!, pendingLevelGrant: granted };
    this.active.next(next);
    return of(next);
  }
}

describe('MainContentComponent level-up', () => {
  let fixture: ComponentFixture<MainContentComponent>;
  let pcs: PcServiceStub;
  let prompt: LevelUpPromptService;
  const dmReturn = signal(false);

  const hero = (over: Partial<PC> = {}): PC =>
    ({ id: 7, name: 'Aria', level: 3, xp: 0, pendingLevelGrant: false, ...over } as PC);

  beforeEach(() => {
    localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
    dmReturn.set(false);
    pcs = new PcServiceStub();
    TestBed.configureTestingModule({
      imports: [MainContentComponent],
      providers: [
        { provide: PCService, useValue: pcs },
        { provide: UiStateService, useValue: { dmReturn } },
        { provide: CharacterModalService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: NotificationService, useValue: { notify: () => undefined } },
        { provide: CampaignService, useValue: { getSummary: () => of({}) } },
        { provide: JoinModalService, useValue: {} },
        { provide: DiceRollerService, useValue: {} },
      ],
    });
    // The sheet and friends are not under test — render them as inert elements,
    // so the sheet's (levelUpRequested) binding is a plain DOM listener.
    TestBed.overrideComponent(MainContentComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } });
    prompt = TestBed.inject(LevelUpPromptService);
    fixture = TestBed.createComponent(MainContentComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
  });

  function show(pc: PC, { owned = true } = {}): void {
    if (owned) pcs.roster = [pc];
    pcs.active.next(pc);
    fixture.detectChanges();
  }

  it("prompts when the player's own active character can level", () => {
    show(hero({ pendingLevelGrant: true }));

    expect(prompt.prompt()).toEqual(jasmine.objectContaining({ pcId: 7, targetLevel: 4, reason: 'grant' }));
  });

  it('prompts when a refetch brings in a grant made from another client', () => {
    show(hero());
    expect(prompt.prompt()).toBeNull();

    pcs.active.next(hero({ pendingLevelGrant: true })); // the refocus refetch lands
    expect(prompt.prompt()).not.toBeNull();
  });

  it('never prompts a DM in cross-link view, including after their own Grant Level-Up click', () => {
    dmReturn.set(true);
    show(hero());

    pcs.grantLevelUp(7, true).subscribe(); // the sheet's Grant Level-Up button path

    expect(pcs.active.getValue()?.pendingLevelGrant).toBeTrue();
    expect(prompt.prompt()).toBeNull();
  });

  it('does not prompt for a character outside the signed-in roster', () => {
    show(hero({ pendingLevelGrant: true }), { owned: false });

    expect(prompt.prompt()).toBeNull();
  });

  it("the sheet's Level Up button opens the shared level-up modal", () => {
    const pc = hero({ xp: 2_700 });
    show(pc);
    prompt.later(); // answered the prompt — the button must still work

    fixture.nativeElement.querySelector('app-character-sheet')
      .dispatchEvent(new CustomEvent('levelUpRequested'));

    expect(prompt.levelUp()).toEqual({ pc, asDm: false });
  });

  it('the DM cross-link Level Up button opens the modal on the DM-authorized path', () => {
    dmReturn.set(true);
    const pc = hero();
    show(pc);

    fixture.nativeElement.querySelector('app-character-sheet')
      .dispatchEvent(new CustomEvent('levelUpRequested'));

    expect(prompt.levelUp()).toEqual({ pc, asDm: true });
  });

  it("leaving the sheet closes a DM's modal but not a player's", () => {
    dmReturn.set(true);
    show(hero());
    prompt.openLevelUp(hero(), true);
    fixture.destroy();
    expect(prompt.levelUp()).toBeNull();

    prompt.openLevelUp(hero(), false);
    const again = TestBed.createComponent(MainContentComponent);
    again.detectChanges();
    again.destroy();
    expect(prompt.levelUp()).not.toBeNull();
    prompt.closeLevelUp();
  });

  // ── Level watch: level-ups from another client, no reload ──────────────────
  // The beforeEach fixture's timer runs on the real clock; each of these
  // remounts inside fakeAsync so tick() drives the watch, and destroys the
  // fixture before leaving so no periodic timer is left in the fake queue.

  describe('level watch', () => {
    const member = (over: Partial<PC> = {}): PC => hero({ campaignId: 1, ...over });

    function remount(): void {
      fixture.destroy();
      fixture = TestBed.createComponent(MainContentComponent);
      fixture.detectChanges();
    }

    it("checks the player's own campaign character every few seconds", fakeAsync(() => {
      remount();
      show(member());

      tick(LEVEL_WATCH_MS);
      expect(pcs.syncLevelState).toHaveBeenCalledOnceWith(7, false);
      tick(LEVEL_WATCH_MS);
      expect(pcs.syncLevelState).toHaveBeenCalledTimes(2);
      fixture.destroy();
    }));

    it('never checks a character in no campaign', fakeAsync(() => {
      remount();
      show(hero());

      tick(LEVEL_WATCH_MS * 2);
      expect(pcs.syncLevelState).not.toHaveBeenCalled();
      fixture.destroy();
    }));

    it('a DM grant from another client reaches the prompt without a reload', fakeAsync(() => {
      remount();
      show(member());
      expect(prompt.prompt()).toBeNull();
      pcs.syncLevelState.and.callFake(() => {
        pcs.active.next(member({ pendingLevelGrant: true })); // what the service pushes on a change
        return of(undefined);
      });

      tick(LEVEL_WATCH_MS);

      expect(prompt.prompt()).toEqual(jasmine.objectContaining({ pcId: 7, targetLevel: 4, reason: 'grant' }));
      fixture.destroy();
    }));

    it('chains: the player levels up, the DM grants again, the next prompt follows', fakeAsync(() => {
      remount();
      show(member({ pendingLevelGrant: true }));
      prompt.levelUpNow();

      // The commit mirrors the new level, then the modal closes.
      pcs.roster = [member({ level: 4 })];
      pcs.active.next(member({ level: 4 }));
      prompt.closeLevelUp();
      expect(prompt.prompt()).toBeNull();

      pcs.syncLevelState.and.callFake(() => {
        pcs.active.next(member({ level: 4, pendingLevelGrant: true })); // the DM's second grant
        return of(undefined);
      });
      tick(LEVEL_WATCH_MS);

      expect(prompt.prompt()).toEqual(jasmine.objectContaining({ targetLevel: 5, reason: 'grant' }));
      fixture.destroy();
    }));

    it('pauses while the level-up modal is open', fakeAsync(() => {
      remount();
      show(member());
      prompt.openLevelUp(member(), false);

      tick(LEVEL_WATCH_MS);
      expect(pcs.syncLevelState).not.toHaveBeenCalled();

      prompt.closeLevelUp();
      tick(LEVEL_WATCH_MS);
      expect(pcs.syncLevelState).toHaveBeenCalledTimes(1);
      fixture.destroy();
    }));

    it("watches a member's sheet for a DM only while their grant is unspent", fakeAsync(() => {
      dmReturn.set(true);
      remount();
      show(member(), { owned: false });

      tick(LEVEL_WATCH_MS);
      expect(pcs.syncLevelState).not.toHaveBeenCalled();

      pcs.grantLevelUp(7, true).subscribe(); // Grant Level-Up
      tick(LEVEL_WATCH_MS);
      expect(pcs.syncLevelState).toHaveBeenCalledOnceWith(7, true);

      pcs.active.next(member({ level: 4, pendingLevelGrant: false })); // the player spent it
      tick(LEVEL_WATCH_MS);
      expect(pcs.syncLevelState).toHaveBeenCalledTimes(1);
      fixture.destroy();
    }));

    it('keeps watching after a failed check', fakeAsync(() => {
      remount();
      show(member());
      pcs.syncLevelState.and.returnValue(new Observable(sub => sub.error(new Error('offline'))));

      tick(LEVEL_WATCH_MS);
      tick(LEVEL_WATCH_MS);

      expect(pcs.syncLevelState).toHaveBeenCalledTimes(2);
      fixture.destroy();
    }));
  });
});
