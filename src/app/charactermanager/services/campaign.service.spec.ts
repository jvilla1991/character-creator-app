import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';

// Class-only tests (no TestBed) with a stubbed HttpClient, matching the house
// style. Runs in real mode (karma has no demoMode localStorage opt-in).
describe('CampaignService', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let pcService: jasmine.SpyObj<PCService>;
  let service: CampaignService;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'delete']);
    pcService = jasmine.createSpyObj<PCService>(
      'PCService', ['deserialize', 'patchLocalPC', 'getPCById', 'updatePC']);
    http.get.and.returnValue(of([])); // constructor's refreshCampaigns()
    service = new CampaignService(http, pcService);
    http.get.calls.reset();
  });

  describe('getSummary', () => {
    it('parses the variantRules JSON TEXT into an object', done => {
      http.get.and.returnValue(of({ id: 5, name: 'Darker Table', variantRules: '{"slotInventory":true}' }));

      service.getSummary(5).subscribe(summary => {
        expect(summary.name).toBe('Darker Table');
        expect(summary.variantRules.slotInventory).toBe(true);
        done();
      });
    });

    it('caches per campaign id — variant rules are immutable after creation', () => {
      http.get.and.returnValue(of({ id: 5, name: 'Darker Table', variantRules: null }));

      service.getSummary(5).subscribe();
      service.getSummary('5').subscribe();

      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('previewByCode', () => {
    it('normalizes the code and tolerates a null variantRules column', done => {
      http.get.and.returnValue(of({ name: 'Plain Table', variantRules: null }));

      service.previewByCode(' veil23 ').subscribe(preview => {
        expect(http.get).toHaveBeenCalledWith(jasmine.stringMatching(/invite\/VEIL23\/preview$/));
        expect(preview.variantRules).toEqual({});
        done();
      });
    });
  });

  describe('join', () => {
    it('sends the acknowledgment flag to the backend', () => {
      http.post.and.returnValue(of({ id: 7 }));
      pcService.deserialize.and.returnValue({ id: 7 } as never);

      service.join('veil23', 7, true).subscribe();

      expect(http.post).toHaveBeenCalledWith(
        jasmine.stringMatching(/\/join$/),
        { code: 'VEIL23', pcId: 7, acknowledgeVariantRules: true },
      );
    });
  });
});
