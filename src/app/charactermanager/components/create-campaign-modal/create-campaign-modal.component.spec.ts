import { CreateCampaignModalComponent } from './create-campaign-modal.component';
import { CampaignDraft } from '../../models/campaign';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CreateCampaignModalComponent', () => {
  let component: CreateCampaignModalComponent;
  let emitted: CampaignDraft[];

  beforeEach(() => {
    component = new CreateCampaignModalComponent();
    emitted = [];
    component.confirm.subscribe(d => emitted.push(d));
  });

  it('submit includes the defined week (null when none was picked)', () => {
    component.name = 'Eberron Table';
    component.submit();
    expect(emitted[0].weekDays).toBeNull();

    component.weekDays = ['Sul', 'Mol', 'Zol'];
    component.submit();
    expect(emitted[1].weekDays).toEqual(['Sul', 'Mol', 'Zol']);
  });

  it('a start weekday outside a newly picked definition is cleared', () => {
    component.startWeekday = 'Far';
    component.onWeekDaysChange(['Sul', 'Mol', 'Zol']);
    expect(component.startWeekday).toBe(''); // no longer a defined day — dropped

    component.startWeekday = 'mol';
    component.onWeekDaysChange(['Sul', 'Mol']);
    expect(component.startWeekday).toBe('mol'); // still defined (case-insensitive) — kept
  });

  it('the start date still seeds the clock with the selected weekday', () => {
    component.name = 'Timed Table';
    component.weekDays = ['Sul', 'Mol'];
    component.startDay = '3rd';
    component.startWeekday = 'Sul';
    component.submit();
    expect(emitted[0].gameTime).toEqual({
      year: '1', month: '1', day: '3rd', timeOfDay: 'morning',
      weekday: 'Sul', weekdaysSeen: ['Sul'], week: 1,
    });
  });
});
