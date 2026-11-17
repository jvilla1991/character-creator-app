import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { MainContentComponent } from './main-content.component';
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
});
