import { of } from 'rxjs';
import { SessionModeComponent } from './session-mode.component';
import { SessionState } from '../../models/session';

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
