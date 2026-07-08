import { of, throwError } from 'rxjs';
import { CampaignWeekComponent } from './campaign-week.component';
import { Campaign } from '../../../models/campaign';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CampaignWeekComponent', () => {
  let component: CampaignWeekComponent;
  let service: any;

  const campaign = (weekDays: string[] | null = null): Campaign =>
    ({ id: '1', name: 'The Veiled Compass', weekDays } as unknown as Campaign);

  beforeEach(() => {
    service = jasmine.createSpyObj('CampaignService', ['setWeekDays']);
    component = new CampaignWeekComponent(service);
    component.campaign = campaign();
  });

  it('summarizes the definition, or the free-text fallback when undefined', () => {
    expect(component.summary).toBe('Free-text weekdays — repetition counts weeks');
    component.campaign = campaign(['Sul', 'Mol']);
    expect(component.summary).toBe('Sul · Mol');
  });

  it('edit seeds the draft from the campaign; save persists it and closes', () => {
    component.campaign = campaign(['Sul', 'Mol']);
    component.edit();
    expect(component.draft).toEqual(['Sul', 'Mol']);

    component.draft = ['Sul', 'Mol', 'Zol'];
    service.setWeekDays.and.returnValue(of(campaign(['Sul', 'Mol', 'Zol'])));
    component.save();
    expect(service.setWeekDays).toHaveBeenCalledWith('1', ['Sul', 'Mol', 'Zol']);
    expect(component.editing).toBeFalse();
    expect(component.saving).toBeFalse();
  });

  it('save keeps the editor open on an error so the DM can retry', () => {
    component.edit();
    component.draft = ['Sul', 'Mol'];
    service.setWeekDays.and.returnValue(throwError(() => new Error('boom')));
    component.save();
    expect(component.editing).toBeTrue();
    expect(component.saving).toBeFalse();
  });

  it('cancel closes without saving; a campaign switch resets the editor', () => {
    component.edit();
    component.cancel();
    expect(service.setWeekDays).not.toHaveBeenCalled();

    component.edit();
    component.ngOnChanges({ campaign: {} as never });
    expect(component.editing).toBeFalse();
  });
});
