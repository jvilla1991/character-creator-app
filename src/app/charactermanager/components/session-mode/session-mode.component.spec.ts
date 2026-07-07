import { of, throwError } from 'rxjs';
import { SessionModeComponent } from './session-mode.component';
import { ParticipantView, SessionState } from '../../models/session';
import { PCService } from '../../services/pc.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { PC } from '../../models/pc';

// Class-only test of the initiative-visibility predicate (no TestBed; only
// sessionService.state$ is touched during construction, so stub just that).
describe('SessionModeComponent.showInitiative', () => {
  const sessionServiceStub = { state$: of(null) } as never;
  const component = new SessionModeComponent(
    sessionServiceStub, null as never, null as never, null as never, null as never, null as never);

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
    component = new SessionModeComponent(
      sessionServiceStub, uiState, pcService, notifications, null as never, null as never);
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
