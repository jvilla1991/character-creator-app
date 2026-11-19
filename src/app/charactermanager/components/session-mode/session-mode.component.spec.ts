import { Subject, of, throwError } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionModeComponent } from './session-mode.component';
import { LongRestResultView, LongRestView, ParticipantView, RestVoteView, SessionState } from '../../models/session';
import { SessionService } from '../../services/session.service';
import { PCService } from '../../services/pc.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
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
      sessionServiceStub, null as never, null as never, null as never, null as never, null as never, null as never));
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
      sessionServiceStub, uiState, pcService, notifications, null as never, null as never, null as never));
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

    expect(notifications.notify).toHaveBeenCalledWith('Could not open that character sheet. Try again.');
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
      sessionService, uiState, null as never, notifications, null as never, null as never, null as never));
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

  const restVote = (status: RestVoteView['status'], voteId = 10,
                    restType: RestVoteView['restType'] = 'SHORT'): RestVoteView => ({
    voteId,
    status,
    restType,
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
      sessionService, null as never, null as never, notifications, null as never, null as never, null as never));
  });

  it('initiateRestVote calls the service for this session', () => {
    sessionService.initiateRestVote.and.returnValue(of(state()));

    component.initiateRestVote(state());

    expect(sessionService.initiateRestVote).toHaveBeenCalledWith(1, 'SHORT');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('the Rest dialog opens on the button and closes as it calls the chosen vote', () => {
    sessionService.initiateRestVote.and.returnValue(of(state()));

    component.openRestChooser();
    expect(component.restChooserOpen).toBeTrue();

    component.callRest('LONG', state());

    expect(component.restChooserOpen).toBeFalse();
    expect(sessionService.initiateRestVote).toHaveBeenCalledWith(1, 'LONG');
  });

  it('a failed long rest call falls back to its own message', () => {
    sessionService.initiateRestVote.and.returnValue(throwError(() => ({})));

    component.initiateRestVote(state(), 'LONG');

    expect(notifications.notify).toHaveBeenCalledWith('Could not call a long rest.');
  });

  it('Rest is blocked by an open long rest, an open short rest, a live vote or an encounter', () => {
    expect(component.restBlockedReason(state())).toBeNull();
    expect(component.restBlockedReason(state({ longRest: {} as LongRestView })))
      .toBe('A long rest is already underway.');
    expect(component.restBlockedReason(state({ shortRestOpen: true })))
      .toBe('A short rest is already underway.');
    expect(component.restBlockedReason(state({ restVote: restVote('ACTIVE') })))
      .toBe('A rest vote is already being tallied.');
    expect(component.restBlockedReason(state({ status: 'ACTIVE' })))
      .toBe('No resting mid-encounter. Wait until the encounter ends.');
    // A finished vote does not block the next one.
    expect(component.restBlockedReason(state({ restVote: restVote('FAILED') }))).toBeNull();
  });

  it('toasts a long vote in its own words', () => {
    const track = (s: SessionState) =>
      (component as unknown as { trackRestVote(s: SessionState): void }).trackRestVote(s);

    track(state({ restVote: restVote('ACTIVE', 10, 'LONG') }));
    track(state({ restVote: restVote('PASSED', 10, 'LONG') }));
    expect(notifications.notify).toHaveBeenCalledWith('The vote passed — the long rest begins.');

    track(state({ restVote: restVote('ACTIVE', 11, 'LONG') }));
    track(state({ restVote: restVote('FAILED', 11, 'LONG') }));
    expect(notifications.notify).toHaveBeenCalledWith('No long rest — the vote failed.');
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
      null as never, TestBed.inject(DestroyRef)));
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

describe('SessionModeComponent help copy', () => {
  let component: SessionModeComponent;

  const state = (over: Partial<SessionState>): SessionState =>
    ({ sessionId: 3, dm: false, status: 'LOBBY', shortRestOpen: false, participants: [], ...over } as unknown as SessionState);

  beforeEach(() => {
    const sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['clear'], { state$: of(null) });
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionService, null as never, null as never, null as never, null as never, null as never, null as never));
  });

  it('says what Rest does when it is available', () => {
    expect(component.restHint(state({}))).toContain('The party votes');
  });

  it('says why Rest is unavailable', () => {
    expect(component.restHint(state({ shortRestOpen: true }))).toBe('A short rest is already underway.');
    expect(component.restHint(state({ restVote: { status: 'ACTIVE' } as never })))
      .toBe('A rest vote is already being tallied.');
    expect(component.restHint(state({ status: 'ACTIVE' as never })))
      .toBe('No resting mid-encounter. Wait until the encounter ends.');
  });

  it('adds what advancing time costs only in a survival campaign', () => {
    component.survivalConditions = false;
    expect(component.clockHelp).not.toContain('eats its supplies');
    component.survivalConditions = true;
    expect(component.clockHelp).toContain('the party eats its supplies');
    expect(component.clockHelp).toContain('and sheds fatigue');
  });
});

describe('SessionModeComponent long rest phase', () => {
  let component: SessionModeComponent;
  let sessionService: jasmine.SpyObj<SessionService>;
  let pcService: jasmine.SpyObj<PCService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  const mySeat = { participantId: 5, pcId: 7, ownedByMe: true, name: 'Bex' } as ParticipantView;

  const state = (overrides: Partial<SessionState> = {}): SessionState =>
    ({
      sessionId: 1,
      dm: false,
      status: 'LOBBY',
      participants: [mySeat],
      rolls: [],
      restVote: null,
      longRest: null,
      longRestResult: null,
      ...overrides,
    } as SessionState);

  const result = (id: number, outcome: LongRestResultView['outcome'], skipped: string[] = []): LongRestResultView =>
    ({ id, outcome, skipped, clockAdvanced: false, createdAt: null });

  const track = (s: SessionState) =>
    (component as unknown as { trackLongRest(s: SessionState): void }).trackLongRest(s);

  beforeEach(() => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService',
      ['openLongRest', 'setLongRestReady', 'setLongRestOptions', 'finishLongRest', 'interruptLongRest'],
      { state$: of(null) });
    pcService = jasmine.createSpyObj<PCService>('PCService', ['getPCById', 'refreshPC']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify']);
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionService, null as never, pcService, notifications, null as never, null as never, null as never));
  });

  it('the DM Long Rest button opens the phase for this session', () => {
    sessionService.openLongRest.and.returnValue(of(state()));

    component.openLongRest(state({ dm: true }));

    expect(sessionService.openLongRest).toHaveBeenCalledWith(1);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('a refused open surfaces the server message', () => {
    sessionService.openLongRest.and.returnValue(
      throwError(() => ({ error: { message: 'Cannot start a long rest during an encounter' } })));

    component.openLongRest(state({ dm: true }));

    expect(notifications.notify).toHaveBeenCalledWith('Cannot start a long rest during an encounter');
  });

  it('the DM cannot start one while a phase is open, a vote runs, or an encounter is on', () => {
    expect(component.dmLongRestBlockedReason(state({ dm: true }))).toBeNull();
    expect(component.dmLongRestBlockedReason(state({ dm: true, longRest: {} as LongRestView })))
      .toBe('A long rest is already underway');
    expect(component.dmLongRestBlockedReason(state({ dm: true, restVote: { status: 'ACTIVE' } as RestVoteView })))
      .toBe('A rest vote is being tallied — allow or deny it');
    expect(component.dmLongRestBlockedReason(state({ dm: true, status: 'ACTIVE' })))
      .toBe('No resting mid-encounter');
  });

  it('Ready is sent for the player\'s own seated hero', () => {
    sessionService.setLongRestReady.and.returnValue(of(state()));

    component.setLongRestReady(true, state());
    component.setLongRestReady(false, state());

    expect(sessionService.setLongRestReady.calls.allArgs()).toEqual([[1, 7, true, {}], [1, 7, false, {}]]);
  });

  it('Ready does nothing for a viewer with no seated hero', () => {
    component.setLongRestReady(true, state({ participants: [] }));
    expect(sessionService.setLongRestReady).not.toHaveBeenCalled();
  });

  it('options, finish and interrupt go to the service for this session', () => {
    sessionService.setLongRestOptions.and.returnValue(of(state()));
    sessionService.finishLongRest.and.returnValue(of(state()));
    sessionService.interruptLongRest.and.returnValue(of(state()));

    component.setLongRestOptions({ advanceClock: false }, state({ dm: true }));
    component.finishLongRest(state({ dm: true }));
    component.interruptLongRest(state({ dm: true }));

    expect(sessionService.setLongRestOptions).toHaveBeenCalledWith(1, { advanceClock: false });
    expect(sessionService.finishLongRest).toHaveBeenCalledWith(1);
    expect(sessionService.interruptLongRest).toHaveBeenCalledWith(1);
  });

  it('the player long rest screen has a hero for a seated player and none for the DM', () => {
    pcService.getPCById.and.returnValue({ id: 7, name: 'Bex' } as PC);

    expect(component.longRestPc(state())?.name).toBe('Bex');
    expect(component.longRestPc(state({ dm: true }))).toBeUndefined();
  });

  it('announces a finished rest once and refreshes the player\'s hero', () => {
    track(state());                                             // first look: nothing yet
    track(state({ longRestResult: result(77, 'FINISHED') }));

    expect(notifications.notify).toHaveBeenCalledOnceWith('The long rest is over. Bex is restored.');
    expect(pcService.refreshPC).toHaveBeenCalledOnceWith(7);

    track(state({ longRestResult: result(77, 'FINISHED') }));   // still on the snapshot
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(pcService.refreshPC).toHaveBeenCalledTimes(1);
  });

  it('tells a player whose hero was at 0 Hit Points that they did not recover', () => {
    track(state());
    track(state({ longRestResult: result(77, 'FINISHED', ['Bex']) }));

    expect(notifications.notify).toHaveBeenCalledOnceWith(
      'The long rest is over. Bex was at 0 Hit Points and did not recover.');
  });

  it('tells the DM who was skipped, and refreshes no hero', () => {
    track(state({ dm: true }));
    track(state({ dm: true, longRestResult: result(77, 'FINISHED', ['Mira', 'Oswin']) }));

    expect(notifications.notify).toHaveBeenCalledOnceWith(
      'The long rest is over. At 0 Hit Points, not recovered: Mira, Oswin.');
    expect(pcService.refreshPC).not.toHaveBeenCalled();
  });

  it('announces an interrupted rest, with no refresh', () => {
    track(state());
    track(state({ longRestResult: result(78, 'INTERRUPTED') }));

    expect(notifications.notify).toHaveBeenCalledOnceWith('The long rest was interrupted. Nobody recovered.');
    expect(pcService.refreshPC).not.toHaveBeenCalled();
  });

  it('an outcome already on the first snapshot (rejoin) is not announced, but the next one is', () => {
    track(state({ longRestResult: result(77, 'FINISHED') }));
    expect(notifications.notify).not.toHaveBeenCalled();

    track(state({ longRestResult: result(78, 'INTERRUPTED') }));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });
});

describe('SessionModeComponent long rest choices', () => {
  let component: SessionModeComponent;
  let sessionService: jasmine.SpyObj<SessionService>;
  let pcService: jasmine.SpyObj<PCService>;

  const mySeat = { participantId: 5, pcId: 7, ownedByMe: true, name: 'Mira' } as ParticipantView;

  const cleric = {
    id: 7, name: 'Mira', clazz: 'Cleric', level: 5,
    spells: [
      { name: 'Bless', lvl: 1, prepared: true },
      { name: 'Command', lvl: 1, prepared: false },
    ],
  } as PC;

  const knight = {
    id: 7, name: 'Thorne', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Blood',
    level: 5, stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 16 },
    inventory: [{ name: 'Maul', category: 'weapon', qty: 1 }],
  } as PC;

  const phase = (over: Partial<LongRestView> = {}): LongRestView => ({
    advanceClock: true, undisturbed: true, readyCount: 0, ableCount: 1,
    readiness: [{ participantId: 5, pcId: 7, displayName: 'Mira', ready: false, cannotRest: false }],
    myChoices: null,
    ...over,
  });

  const state = (overrides: Partial<SessionState> = {}): SessionState =>
    ({
      sessionId: 1, dm: false, status: 'LOBBY', participants: [mySeat], rolls: [],
      restVote: null, longRest: phase(), longRestResult: null,
      ...overrides,
    } as SessionState);

  const track = (s: SessionState) =>
    (component as unknown as { trackLongRestDraft(s: SessionState): void }).trackLongRestDraft(s);

  beforeEach(() => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['setLongRestReady'], { state$: of(null) });
    sessionService.setLongRestReady.and.returnValue(of(state()));
    pcService = jasmine.createSpyObj<PCService>('PCService', ['getPCById']);
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionService, null as never, pcService, null as never, null as never, null as never, null as never));
  });

  it('starts a draft from the sheet when a rest opens, and keeps it across polls', () => {
    pcService.getPCById.and.returnValue(cleric);

    track(state());
    expect(component.longRestDraft).toEqual({
      pcId: 7, originalSpells: ['Bless'], spells: ['Bless'], originalRune: null, rune: null,
    });

    component.longRestDraft = { ...component.longRestDraft!, spells: ['Command'] };
    track(state()); // the next poll must not reset a half-made choice
    expect(component.longRestDraft!.spells).toEqual(['Command']);
  });

  it('drops the draft when the rest closes, and has none for the DM or a hero with nothing to choose', () => {
    pcService.getPCById.and.returnValue(cleric);
    track(state());
    track(state({ longRest: null }));
    expect(component.longRestDraft).toBeNull();

    track(state({ dm: true }));
    expect(component.longRestDraft).toBeNull();

    pcService.getPCById.and.returnValue({ id: 7, name: 'Bex', clazz: 'Fighter', level: 5 } as PC);
    track(state());
    expect(component.longRestDraft).toBeNull();
  });

  it('picks up the choices the server already holds (a reload while Ready)', () => {
    pcService.getPCById.and.returnValue(cleric);

    track(state({ longRest: phase({ myChoices: { preparedSpells: ['Command'] } }) }));

    expect(component.longRestDraft!.spells).toEqual(['Command']);
    expect(component.longRestDraft!.originalSpells).toEqual(['Bless']);
  });

  it('Ready sends what the player changed; taking it back sends nothing', () => {
    pcService.getPCById.and.returnValue(cleric);
    track(state());
    component.longRestDraft = { ...component.longRestDraft!, spells: ['Command'] };

    component.setLongRestReady(true, state());
    component.setLongRestReady(false, state());

    expect(sessionService.setLongRestReady.calls.allArgs()).toEqual([
      [1, 7, true, { preparedSpells: ['Command'] }],
      [1, 7, false, {}],
    ]);
  });

  it('holds Ready back until a Death Knight picks the rune weapon, then shows the Blood Rune gift', () => {
    pcService.getPCById.and.returnValue(knight);
    track(state());

    expect(component.longRestReadyBlocked(knight)).toBe('Choose the weapon that carries your rune first.');
    expect(component.longRestTempHp(knight)).toBe(0);

    component.longRestDraft = { ...component.longRestDraft!, rune: 'Maul' };

    expect(component.longRestReadyBlocked(knight)).toBeNull();
    expect(component.longRestTempHp(knight)).toBe(8);
  });

  it('knows when this player is Ready (their choices are then read-only)', () => {
    expect(component.isLongRestReady(state())).toBeFalse();
    const ready = phase();
    ready.readiness[0] = { ...ready.readiness[0], ready: true };
    expect(component.isLongRestReady(state({ longRest: ready }))).toBeTrue();
    expect(component.isLongRestReady(state({ longRest: null }))).toBeFalse();
  });
});
