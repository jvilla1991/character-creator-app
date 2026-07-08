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
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'put', 'delete']);
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

  describe('game clock (de)serialization', () => {
    it('createCampaign sends gameTime as a JSON string (null when unset) and parses it back', done => {
      const start = {
        year: '1492 DR', month: 'Hammer', day: '3rd', timeOfDay: 'morning' as const,
        weekday: 'Far', weekdaysSeen: ['Far'], week: 1,
      };
      http.post.and.returnValue(of({ id: 9, name: 'Timed Table', gameTime: JSON.stringify(start) }));

      service.createCampaign({
        name: 'Timed Table', setting: '', tint: 'celestial', variantRules: {}, gameTime: start,
      }).subscribe(campaign => {
        const body = http.post.calls.mostRecent().args[1] as Record<string, unknown>;
        expect(body['gameTime']).toBe(JSON.stringify(start));
        expect(campaign.gameTime).toEqual(start);
        done();
      });
    });

    it('normalizes a pre-v2 numeric clock arriving from the backend', done => {
      http.post.and.returnValue(of({
        id: 9, name: 'Old Table',
        gameTime: '{"year":1492,"month":3,"day":12,"timeOfDay":"dawn"}',
      }));

      service.createCampaign({
        name: 'Old Table', setting: '', tint: 'celestial', variantRules: {},
      }).subscribe(campaign => {
        expect(campaign.gameTime).toEqual({
          year: '1492', month: '3', day: '12', timeOfDay: 'morning',
          weekday: null, weekdaysSeen: [], week: 1,
        });
        done();
      });
    });

    it('createCampaign without a start date sends null (clock never set)', done => {
      http.post.and.returnValue(of({ id: 9, name: 'Plain Table', gameTime: null }));

      service.createCampaign({
        name: 'Plain Table', setting: '', tint: 'celestial', variantRules: {},
      }).subscribe(campaign => {
        const body = http.post.calls.mostRecent().args[1] as Record<string, unknown>;
        expect(body['gameTime']).toBeNull();
        expect(campaign.gameTime).toBeNull();
        done();
      });
    });

    it('createCampaign sends location as a JSON string and parses a valid one back', done => {
      http.post.and.returnValue(of({
        id: 9, name: 'Placed Table',
        location: JSON.stringify({ name: 'Neverwinter', type: 'Settlement' }),
      }));

      service.createCampaign({
        name: 'Placed Table', setting: '', tint: 'celestial', variantRules: {},
      }).subscribe(campaign => {
        expect(campaign.location).toEqual({ name: 'Neverwinter', type: 'Settlement' });
        done();
      });
    });

    it('rejects a location with an unrecognized type (→ null)', done => {
      http.post.and.returnValue(of({
        id: 9, name: 'Bad Table', location: JSON.stringify({ name: 'X', type: 'Tavern' }),
      }));

      service.createCampaign({
        name: 'Bad Table', setting: '', tint: 'celestial', variantRules: {},
      }).subscribe(campaign => {
        expect(campaign.location).toBeNull();
        done();
      });
    });

    it('setLocalGameTime updates the stored campaign copy', done => {
      http.post.and.returnValue(of({ id: 9, name: 'Timed Table', gameTime: null }));

      service.createCampaign({
        name: 'Timed Table', setting: '', tint: 'celestial', variantRules: {},
      }).subscribe(() => {
        const t = { year: '2', month: '1', day: '1', timeOfDay: 'night' as const,
                    weekday: 'Sul', weekdaysSeen: ['Sul'], week: 3 };
        service.setLocalGameTime(9, t);
        expect(service.getLocalCampaign(9)?.gameTime).toEqual(t);
        done();
      });
    });
  });

  describe('week definition (weekDays)', () => {
    it('createCampaign sends weekDays as a JSON string (null when undefined) and parses it back', done => {
      http.post.and.returnValue(of({
        id: 9, name: 'Eberron Table', weekDays: '["Sul","Mol","Zol"]',
      }));

      service.createCampaign({
        name: 'Eberron Table', setting: '', tint: 'celestial', variantRules: {},
        weekDays: ['Sul', 'Mol', 'Zol'],
      }).subscribe(campaign => {
        const body = http.post.calls.mostRecent().args[1] as Record<string, unknown>;
        expect(body['weekDays']).toBe('["Sul","Mol","Zol"]');
        expect(campaign.weekDays).toEqual(['Sul', 'Mol', 'Zol']);
        done();
      });
    });

    it('createCampaign without a definition sends null; malformed columns parse to null', done => {
      http.post.and.returnValue(of({ id: 9, name: 'Plain Table', weekDays: 'not json' }));

      service.createCampaign({
        name: 'Plain Table', setting: '', tint: 'celestial', variantRules: {},
      }).subscribe(campaign => {
        const body = http.post.calls.mostRecent().args[1] as Record<string, unknown>;
        expect(body['weekDays']).toBeNull();
        expect(campaign.weekDays).toBeNull();
        done();
      });
    });

    it('setWeekDays PUTs the list and patches the stored campaign copy', done => {
      http.post.and.returnValue(of({ id: 9, name: 'Timed Table', weekDays: null }));
      service.createCampaign({
        name: 'Timed Table', setting: '', tint: 'celestial', variantRules: {},
      }).subscribe(() => {
        http.put.and.returnValue(of({
          id: 9, name: 'Timed Table', weekDays: '["Sul","Mol"]',
        }));

        service.setWeekDays(9, ['Sul', 'Mol']).subscribe(campaign => {
          expect(http.put).toHaveBeenCalledWith(
            jasmine.stringMatching(/\/campaign\/9\/week-days$/),
            { weekDays: ['Sul', 'Mol'] },
          );
          expect(campaign.weekDays).toEqual(['Sul', 'Mol']);
          expect(service.getLocalCampaign(9)?.weekDays).toEqual(['Sul', 'Mol']);
          done();
        });
      });
    });

    it('setWeekDays with null clears the definition (free-text weekdays resume)', done => {
      http.put.and.returnValue(of({ id: 9, name: 'Timed Table', weekDays: null }));

      service.setWeekDays(9, null).subscribe(campaign => {
        expect(http.put).toHaveBeenCalledWith(jasmine.anything(), { weekDays: null });
        expect(campaign.weekDays).toBeNull();
        done();
      });
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
