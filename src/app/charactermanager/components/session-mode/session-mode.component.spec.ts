import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { SessionModeComponent } from './session-mode.component';
import { ParticipantView, RestVoteView, SessionState } from '../../models/session';
import { SessionService } from '../../services/session.service';
import { PCService } from '../../services/pc.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { PC } from '../../models/pc';

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
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify']);
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

    expect(notifications.notify).toHaveBeenCalledWith('Could not open that character sheet.');
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

describe('SessionModeComponent.openRoll / closeRoll', () => {
  const sessionServiceStub = { state$: of(null) } as never;
  let component: SessionModeComponent;

  beforeEach(() => {
    component = TestBed.runInInjectionContext(() => new SessionModeComponent(
      sessionServiceStub, null as never, null as never, null as never, null as never, null as never, null as never));
  });

  it('openRoll sets the pc and opens the modal', () => {
    const pc = { id: 7, name: 'Aria' } as PC;
    component.openRoll(pc);

    expect(component.rollModalOpen).toBeTrue();
    expect(component.rollPc).toBe(pc);
  });

  it('closeRoll clears the pc and closes the modal', () => {
    component.openRoll({ id: 7, name: 'Aria' } as PC);
    component.closeRoll();

    expect(component.rollModalOpen).toBeFalse();
    expect(component.rollPc).toBeNull();
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
      sessionService, null as never, null as never, notifications, null as never, null as never, null as never));
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
