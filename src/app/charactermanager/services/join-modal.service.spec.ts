import { of, throwError } from 'rxjs';
import { JoinModalService } from './join-modal.service';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';
import { PC } from '../models/pc';

// Class-only tests (no TestBed): stubbed collaborators, matching the house style.
describe('JoinModalService', () => {
  let campaignService: jasmine.SpyObj<CampaignService>;
  let pcService: jasmine.SpyObj<PCService>;
  let service: JoinModalService;

  const joined = { id: 7 } as PC;
  const req = { code: 'VEIL23', pcId: 7 };

  beforeEach(() => {
    campaignService = jasmine.createSpyObj<CampaignService>('CampaignService', ['previewByCode', 'join']);
    pcService = jasmine.createSpyObj<PCService>('PCService', ['refreshPCs']);
    service = new JoinModalService(campaignService, pcService);
  });

  function currentConsent() {
    let value: unknown = 'unset';
    service.consent$.subscribe(v => (value = v)).unsubscribe();
    return value;
  }

  function currentError() {
    let value: unknown = 'unset';
    service.error$.subscribe(v => (value = v)).unsubscribe();
    return value;
  }

  it('joins directly (unacknowledged) when the campaign has no variant rules', () => {
    campaignService.previewByCode.and.returnValue(of({ name: 'Plain Table', variantRules: {} }));
    campaignService.join.and.returnValue(of(joined));

    service.onJoin(req);

    expect(campaignService.join).toHaveBeenCalledWith('VEIL23', 7, false);
    expect(pcService.refreshPCs).toHaveBeenCalled();
    expect(currentConsent()).toBeNull();
  });

  it('holds a slot-inventory join behind the consent pane', () => {
    campaignService.previewByCode.and.returnValue(
      of({ name: 'Darker Table', variantRules: { slotInventory: true } })
    );

    service.onJoin(req);

    expect(campaignService.join).not.toHaveBeenCalled();
    expect(currentConsent()).toEqual({ req, campaignName: 'Darker Table' });
  });

  it('acceptConsent runs the acknowledged join and clears the pane', () => {
    campaignService.previewByCode.and.returnValue(
      of({ name: 'Darker Table', variantRules: { slotInventory: true } })
    );
    campaignService.join.and.returnValue(of(joined));

    service.onJoin(req);
    service.acceptConsent();

    expect(campaignService.join).toHaveBeenCalledWith('VEIL23', 7, true);
    expect(currentConsent()).toBeNull();
  });

  it('declineConsent cancels the join entirely', () => {
    campaignService.previewByCode.and.returnValue(
      of({ name: 'Darker Table', variantRules: { slotInventory: true } })
    );

    service.onJoin(req);
    service.declineConsent();

    expect(campaignService.join).not.toHaveBeenCalled();
    expect(currentConsent()).toBeNull();
  });

  it('surfaces an unknown-code error from the preview', () => {
    campaignService.previewByCode.and.returnValue(throwError(() => new Error('404')));

    service.onJoin(req);

    expect(currentError()).toBe('No campaign found for that invite code.');
    expect(campaignService.join).not.toHaveBeenCalled();
  });

  it('maps a 409 from the join to the consent-required message', () => {
    campaignService.previewByCode.and.returnValue(of({ name: 'Plain Table', variantRules: {} }));
    campaignService.join.and.returnValue(throwError(() => ({ status: 409 })));

    service.onJoin(req);

    expect(currentError()).toBe('This campaign requires accepting the inventory conversion.');
  });

  // --- preselected character (opened from a character sheet) ---

  function currentPreselect() {
    let value: unknown = 'unset';
    service.preselectPcId$.subscribe(v => (value = v)).unsubscribe();
    return value;
  }

  it('open(7) publishes the character to preselect', () => {
    service.open(7);

    expect(currentPreselect()).toBe(7);
  });

  it('open() with no argument publishes no preselect (sidenav path stays source-compatible)', () => {
    service.open(7);
    service.open();

    expect(currentPreselect()).toBeNull();
  });

  it('close() clears the preselect', () => {
    service.open(7);
    service.close();

    expect(currentPreselect()).toBeNull();
  });
});
