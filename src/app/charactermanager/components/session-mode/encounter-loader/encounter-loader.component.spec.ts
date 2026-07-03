import { of, throwError } from 'rxjs';
import { EncounterLoaderComponent } from './encounter-loader.component';
import { SessionState } from '../../../models/session';
import { EncounterSummary } from '../../../models/encounter';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('EncounterLoaderComponent', () => {
  let component: EncounterLoaderComponent;
  let curated: any;
  let session: any;
  let notifications: any;

  const summaries: EncounterSummary[] = [
    { id: 5, campaignId: 1, name: 'Goblin Ambush', notes: 'In the trees.', creatureCount: 3 }];

  const dmState = (over: Partial<SessionState> = {}): SessionState =>
    ({ sessionId: 7, campaignId: 1, dm: true, participants: [], ...over } as unknown as SessionState);

  beforeEach(() => {
    curated = jasmine.createSpyObj('CuratedEncounterService', ['list']);
    curated.list.and.returnValue(of(summaries));
    session = jasmine.createSpyObj('SessionService', ['loadEncounter']);
    notifications = jasmine.createSpyObj('NotificationService', ['notify']);
    component = new EncounterLoaderComponent(curated, session, notifications);
  });

  it('loads the campaign encounters once for the DM', () => {
    component.state = dmState();
    component.ngOnChanges();
    component.ngOnChanges(); // second poll tick — must not refetch
    expect(curated.list).toHaveBeenCalledTimes(1);
    expect(component.encounters).toEqual(summaries);
  });

  it('does not fetch for a non-DM viewer', () => {
    component.state = dmState({ dm: false });
    component.ngOnChanges();
    expect(curated.list).not.toHaveBeenCalled();
  });

  it('exposes the selected encounter notes', () => {
    component.state = dmState();
    component.ngOnChanges();
    component.selectedId = 5;
    expect(component.selectedNotes).toBe('In the trees.');
  });

  it('load posts to the session and toasts on success', () => {
    component.state = dmState();
    component.ngOnChanges();
    component.selectedId = 5;
    session.loadEncounter.and.returnValue(of({} as SessionState));
    component.load();
    expect(session.loadEncounter).toHaveBeenCalledWith(7, 5);
    expect(notifications.notify).toHaveBeenCalledWith('Loaded Goblin Ambush into the session.');
    expect(component.selectedId).toBeNull();
    expect(component.busy).toBeFalse();
  });

  it('load does nothing without a selection', () => {
    component.state = dmState();
    component.load();
    expect(session.loadEncounter).not.toHaveBeenCalled();
  });

  it('load surfaces an error toast and clears busy', () => {
    component.state = dmState();
    component.ngOnChanges();
    component.selectedId = 5;
    session.loadEncounter.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    component.load();
    expect(notifications.notify).toHaveBeenCalledWith('boom');
    expect(component.busy).toBeFalse();
  });
});
