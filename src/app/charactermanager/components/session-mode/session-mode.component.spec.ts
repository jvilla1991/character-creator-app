import { Subject, of, throwError } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionModeComponent } from './session-mode.component';
import { ParticipantView, RestVoteView, SessionState } from '../../models/session';
import { SessionService } from '../../services/session.service';
import { PCService } from '../../services/pc.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { DiceRollerService } from '../../services/dice-roller.service';
import { ConfirmService } from '../modal/confirm.service';
import { PC } from '../../models/pc';
import { LEVEL_UP_ANSWERED_KEY, LevelUpPromptService } from '../../services/level-up-prompt.service';

// Class-only test of the initiative-visibility predicate (no TestBed; only
// sessionService.state$ is touched during construction, so stub just that).
describe('SessionModeComponent.showInitiative', () => {
  const sessionServiceStub = { state$: of(null) } as never;
  let component: SessionModeComponent;
  beforeEach(() => {
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionServiceStub, null as never, null as never, null as never, null as never, null as never, null as never, null as never));
  });

  const state = (dm: boolean, status: SessionState['status']): SessionState =>
    ({ dm, status } as SessionState);

  it('always shows the tracker to the DM (setup controls live there)', () => {
    expect(component.showInitiative(state(true, 'LOBBY'))).toBeTrue();
    expect(component.showInitiative(state(true, 'ACTIVE'))).toBeTrue();
  });

  it('hides the tracker from players until the encounter starts, and after it ends', () => {
    expect(component.showInitiative(state(false, 'LOBBY'))).toBeFalse();
    expect(component.showInitiative(state(false, 'ACTIVE'))).toBeTrue();
    expect(component.showInitiative(state(false, 'ENDED'))).toBeFalse();
  });
});

describe('SessionModeComponent.openPcSheet', () => {
  let component: SessionModeComponent;
  let pcService: jasmine.SpyObj<PCService>;
  let uiState: jasmine.SpyObj<UiStateService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  const participant = (overrides: Partial<ParticipantView> = {}): ParticipantView =>
    ({ participantId: 1, pcId: 7, npc: false, ownedByMe: false, name: 'Aria', ...overrides } as ParticipantView);

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['getPCById', 'getPCByIdAsDm', 'setActivePC']);
    uiState = jasmine.createSpyObj<UiStateService>('UiStateService', ['viewHeroAsDm']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify', 'error']);
    const sessionServiceStub = { state$: of(null) } as never;
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionServiceStub, uiState, pcService, notifications, null as never, null as never, null as never, null as never));
  });

  it('owned PC: opens from the local store with no HTTP fetch', () => {
    const owned = { id: 7, name: 'Aria' } as PC;
    pcService.getPCById.and.returnValue(owned);

    component.openPcSheet(participant());

    expect(pcService.getPCById).toHaveBeenCalledWith(7);
    expect(pcService.getPCByIdAsDm).not.toHaveBeenCalled();
    expect(pcService.setActivePC).toHaveBeenCalledWith(owned);
    expect(uiState.viewHeroAsDm).toHaveBeenCalled();
  });

  it('unowned PC: fetches via the DM-authorized path', () => {
    pcService.getPCById.and.returnValue(undefined);
    const full = { id: 7, name: 'Aria' } as PC;
    pcService.getPCByIdAsDm.and.returnValue(of(full));

    component.openPcSheet(participant());

    expect(pcService.getPCByIdAsDm).toHaveBeenCalledWith(7);
    expect(pcService.setActivePC).toHaveBeenCalledWith(full);
    expect(uiState.viewHeroAsDm).toHaveBeenCalled();
  });

  it('fetch error: notifies and stays in the session (no sheet open)', () => {
    pcService.getPCById.and.returnValue(undefined);
    pcService.getPCByIdAsDm.and.returnValue(throwError(() => new Error('boom')));

    component.openPcSheet(participant());

    expect(notifications.error).toHaveBeenCalledWith(
      'Could not open that character sheet. Try again.', jasmine.any(Error));
    expect(pcService.setActivePC).not.toHaveBeenCalled();
    expect(uiState.viewHeroAsDm).not.toHaveBeenCalled();
  });

  it('empty fetch result: notifies and stays in the session', () => {
    pcService.getPCById.and.returnValue(undefined);
    pcService.getPCByIdAsDm.and.returnValue(of({} as PC));

    component.openPcSheet(participant());

    expect(notifications.notify).toHaveBeenCalledWith('Could not open that character sheet.');
    expect(pcService.setActivePC).not.toHaveBeenCalled();
    expect(uiState.viewHeroAsDm).not.toHaveBeenCalled();
  });

  it('null pcId: no-op', () => {
    component.openPcSheet(participant({ pcId: null }));

    expect(pcService.getPCById).not.toHaveBeenCalled();
    expect(pcService.getPCByIdAsDm).not.toHaveBeenCalled();
    expect(uiState.viewHeroAsDm).not.toHaveBeenCalled();
  });
});

describe('SessionModeComponent ending and leaving', () => {
  let component: SessionModeComponent;
  let sessionService: jasmine.SpyObj<SessionService>;
  let uiState: jasmine.SpyObj<UiStateService>;
  let notifications: jasmine.SpyObj<NotificationService>;
  let confirm: jasmine.Spy;

  const state = { sessionId: 3, dm: true, participants: [] } as unknown as SessionState;

  beforeEach(() => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['end', 'leave', 'clear'], { state$: of(null) });
    uiState = jasmine.createSpyObj<UiStateService>('UiStateService', ['closeSession']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify', 'error']);
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionService, uiState, null as never, notifications, null as never, null as never, null as never, null as never));
    confirm = spyOn(TestBed.inject(ConfirmService), 'confirm').and.returnValue(of(undefined));
  });

  it('End Session asks first, and Keep Playing ends nothing', () => {
    confirm.and.returnValue(of());
    component.endSession(state);
    expect(confirm).toHaveBeenCalledWith(jasmine.objectContaining({ confirmLabel: 'End Session', cancelLabel: 'Keep Playing' }));
    expect(sessionService.end).not.toHaveBeenCalled();
    expect(uiState.closeSession).not.toHaveBeenCalled();
  });

  it('End Session exits once the server has ended it', () => {
    sessionService.end.and.returnValue(of(state));
    component.endSession(state);
    expect(uiState.closeSession).toHaveBeenCalled();
  });

  it('a failed End Session keeps the DM on the screen and says the session is still running', () => {
    sessionService.end.and.returnValue(throwError(() => ({ status: 500 })));
    component.endSession(state);
    expect(uiState.closeSession).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(
      'Could not end the session. It is still running — try again.', jasmine.anything());
  });

  it('End Session on a session that is already gone just exits', () => {
    sessionService.end.and.returnValue(throwError(() => ({ status: 404 })));
    component.endSession(state);
    expect(uiState.closeSession).toHaveBeenCalled();
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('a failed Leave keeps the player in the session and says so', () => {
    spyOn(component, 'myParticipantId').and.returnValue(11);
    sessionService.leave.and.returnValue(throwError(() => ({ status: 0 })));
    component.leave({ ...state, dm: false } as SessionState);
    expect(uiState.closeSession).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(
      'Could not leave the session. You are still in it — try again.', jasmine.anything());
  });
});

describe('SessionModeComponent.openRoll', () => {
  const sessionServiceStub = { state$: of(null) } as never;
  let component: SessionModeComponent;
  let dice: jasmine.SpyObj<DiceRollerService>;

  beforeEach(() => {
    dice = jasmine.createSpyObj<DiceRollerService>('DiceRollerService', ['open', 'close']);
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionServiceStub, null as never, null as never, null as never, null as never, null as never,
      dice, null as never));
  });

  // The roller itself is mounted once in the app shell (and reachable from
  // every screen via the floating launcher); the in-session Roll button is now
  // just another trigger, and owns no modal state of its own.
  it('delegates to the shell-level dice roller', () => {
    component.openRoll();

    expect(dice.open).toHaveBeenCalledTimes(1);
  });
});

describe('SessionModeComponent rest vote', () => {
  let component: SessionModeComponent;
  let sessionService: jasmine.SpyObj<SessionService> & { state$: typeof stateOfNull };
  let notifications: jasmine.SpyObj<NotificationService>;
  const stateOfNull = of(null);

  const state = (overrides: Partial<SessionState> = {}): SessionState =>
    ({
      sessionId: 1,
      dm: false,
      status: 'LOBBY',
      participants: [],
      rolls: [],
      restVote: null,
      ...overrides,
    } as SessionState);

  const restVote = (status: RestVoteView['status'], voteId = 10): RestVoteView => ({
    voteId,
    status,
    initiatorParticipantId: 5,
    initiatorName: 'Gorath',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    votes: [],
  });

  beforeEach(() => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService',
      ['initiateRestVote', 'castRestVote', 'overrideRestVote']) as never;
    (sessionService as { state$: unknown }).state$ = stateOfNull;
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify']);
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionService, null as never, null as never, notifications, null as never, null as never, null as never, null as never));
  });

  it('initiateRestVote calls the service for this session', () => {
    sessionService.initiateRestVote.and.returnValue(of(state()));

    component.initiateRestVote(state());

    expect(sessionService.initiateRestVote).toHaveBeenCalledWith(1);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('initiate failure surfaces the server message (e.g. a vote already runs)', () => {
    sessionService.initiateRestVote.and.returnValue(
      throwError(() => ({ error: { message: 'A rest vote is already in progress' } })));

    component.initiateRestVote(state());

    expect(notifications.notify).toHaveBeenCalledWith('A rest vote is already in progress');
  });

  it('castRestVote and overrideRestVote forward the ballot/override value', () => {
    sessionService.castRestVote.and.returnValue(of(state()));
    sessionService.overrideRestVote.and.returnValue(of(state()));

    component.castRestVote(true, state());
    component.overrideRestVote(false, state());

    expect(sessionService.castRestVote).toHaveBeenCalledWith(1, true);
    expect(sessionService.overrideRestVote).toHaveBeenCalledWith(1, false);
  });

  it('toasts an outcome exactly once, on the ACTIVE → terminal transition', () => {
    const track = (s: SessionState) =>
      (component as unknown as { trackRestVote(s: SessionState): void }).trackRestVote(s);

    track(state({ restVote: restVote('ACTIVE') }));
    expect(notifications.notify).not.toHaveBeenCalled();

    track(state({ restVote: restVote('PASSED') }));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      'The party rests — spend hit dice while the window is open.');

    // The terminal vote keeps riding the snapshot — no repeat toast.
    track(state({ restVote: restVote('PASSED') }));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('a vote first seen already terminal (rejoin mid-outcome) is not announced', () => {
    const track = (s: SessionState) =>
      (component as unknown as { trackRestVote(s: SessionState): void }).trackRestVote(s);

    track(state({ restVote: restVote('FAILED') }));
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe('SessionModeComponent level-up prompt (rides the session poll)', () => {
  let component: SessionModeComponent;
  let states: Subject<SessionState | null>;
  let pcService: { store: PC[]; getPCById: (id: number) => PC | undefined; patchLocalPC: jasmine.Spy };
  let prompt: LevelUpPromptService;

  const seated = (over: Partial<ParticipantView> = {}): ParticipantView =>
    ({ participantId: 1, pcId: 7, npc: false, ownedByMe: true, name: 'Aria', level: 3, ...over } as ParticipantView);

  const snapshot = (over: Partial<SessionState> = {}): SessionState => ({
    sessionId: 1, campaignId: 1, status: 'ACTIVE', dm: false, version: 1,
    gameTime: null, restVote: null, myXp: 0, myLevelGrant: false,
    participants: [seated()], ...over,
  } as SessionState);

  beforeEach(() => {
    localStorage.removeItem(LEVEL_UP_ANSWERED_KEY);
    TestBed.resetTestingModule();
    states = new Subject<SessionState | null>();
    pcService = {
      store: [{ id: 7, name: 'Aria', level: 3, xp: 0, pendingLevelGrant: false } as PC],
      getPCById(id: number) { return this.store.find(p => p.id === id); },
      patchLocalPC: jasmine.createSpy('patchLocalPC'),
    };
    const sessionServiceStub = { state$: states.asObservable(), startPolling: () => undefined, clear: () => undefined };
    const campaignStub = { getSummary: () => of({}) };
    const notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify']);
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionServiceStub as never, null as never, pcService as never, notifications, campaignStub as never,
      null as never, null as never, TestBed.inject(DestroyRef)));
    // The required signal input has no template to bind it here; supply it directly.
    (component as unknown as { sessionId: () => string }).sessionId = () => '1';
    component.ngOnInit();
    prompt = TestBed.inject(LevelUpPromptService);
  });

  afterEach(() => localStorage.removeItem(LEVEL_UP_ANSWERED_KEY));

  it('a snapshot with myLevelGrant: true prompts the seated player and mirrors the grant locally', () => {
    states.next(snapshot({ myLevelGrant: true }));

    expect(prompt.prompt()).toEqual(jasmine.objectContaining({ pcId: 7, targetLevel: 4, reason: 'grant' }));
    expect(pcService.patchLocalPC).toHaveBeenCalledWith(7, { pendingLevelGrant: true });
  });

  it('myLevelGrant null (older backend) falls back to the local store', () => {
    pcService.store[0].pendingLevelGrant = true;

    states.next(snapshot({ myLevelGrant: null }));

    expect(prompt.prompt()).toEqual(jasmine.objectContaining({ reason: 'grant' }));
    expect(pcService.patchLocalPC).not.toHaveBeenCalled();
  });

  it('myLevelGrant null with no local grant does not prompt', () => {
    states.next(snapshot({ myLevelGrant: null }));

    expect(prompt.prompt()).toBeNull();
  });

  it('an XP award crossing the threshold (myXp) prompts and mirrors the XP', () => {
    states.next(snapshot({ myXp: 2_700 }));

    expect(prompt.prompt()).toEqual(jasmine.objectContaining({ targetLevel: 4, reason: 'xp' }));
    expect(pcService.patchLocalPC).toHaveBeenCalledWith(7, { xp: 2_700 });
  });

  it('never prompts the DM (no seated PC; myXp/myLevelGrant null)', () => {
    pcService.store[0].pendingLevelGrant = true; // even if the DM's own PC holds a grant
    states.next(snapshot({
      dm: true, myXp: null, myLevelGrant: null,
      participants: [seated({ ownedByMe: false })],
    }));

    expect(prompt.prompt()).toBeNull();
    expect(pcService.patchLocalPC).not.toHaveBeenCalled();
  });

  it('ignores a snapshot that is behind a level-up already committed here', () => {
    pcService.store[0].level = 4; // levelled up; the poll hasn't caught up
    states.next(snapshot({ myLevelGrant: true, participants: [seated({ level: 3 })] }));

    expect(prompt.prompt()).toBeNull();
    expect(pcService.patchLocalPC).not.toHaveBeenCalled();
  });
});
