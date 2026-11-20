import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RenownService } from './renown.service';

// The session reward bar's two calls: the campaign's factions and the
// renown reward for the ticked characters.
describe('RenownService session rewards', () => {
  let service: RenownService;
  let httpMock: HttpTestingController;
  const base = `${environment.characterApiUrl}/api/v1/session`;
  const recipients = [
    { participantId: 5, pcId: 70, name: 'Gorath' },
    { participantId: 9, pcId: 80, name: 'Mira' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RenownService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(RenownService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('over HTTP', () => {
    it('reads the factions from the session', () => {
      let factions: unknown;
      service.campaignFactions(1, '2').subscribe(f => (factions = f));
      const request = httpMock.expectOne(`${base}/1/factions`);
      expect(request.request.method).toBe('GET');
      request.flush([{ id: 10, parentId: null, name: 'Kirin Tor' }]);
      expect(factions).toEqual([{ id: 10, parentId: null, name: 'Kirin Tor' }]);
    });

    it('posts the faction, the amount and the ticked participant ids', () => {
      let result: unknown;
      service.awardInSession(1, '2', 10, -3, recipients).subscribe(r => (result = r));
      const request = httpMock.expectOne(`${base}/1/renown`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ factionId: 10, amount: -3, participantIds: [5, 9] });
      const awarded = [{ pcId: 70, name: 'Gorath', score: -3, delta: -3 }];
      request.flush({ awarded });
      expect(result).toEqual({ awarded });
    });
  });

  describe('demo mode', () => {
    beforeEach(() => spyOnProperty(environment, 'demoMode', 'get').and.returnValue(true));

    it('lists the factions made on a Renown tab, without scores', async () => {
      const guild = await firstValueFrom(service.create(70, '2', 'Kirin Tor', null));
      expect(await firstValueFrom(service.campaignFactions('demo-session', '2')))
        .toEqual([{ id: guild.id, parentId: null, name: 'Kirin Tor' }]);
      expect(await firstValueFrom(service.campaignFactions('demo-session', '3'))).toEqual([]);
    });

    it('moves each ticked character, clamps at 100 and shows on their Renown tab', async () => {
      const guild = await firstValueFrom(service.create(70, '2', 'Kirin Tor', null));
      await firstValueFrom(service.awardInSession('demo-session', '2', guild.id, 99, [recipients[1]]));

      const result = await firstValueFrom(service.awardInSession('demo-session', '2', guild.id, 3, recipients));

      expect(result.awarded).toEqual([
        { pcId: 70, name: 'Gorath', score: 3, delta: 3 },
        { pcId: 80, name: 'Mira', score: 100, delta: 1 },
      ]);
      expect((await firstValueFrom(service.list(70, '2')))[0].score).toBe(3);
    });

    it('refuses an unknown faction or an empty list of characters', async () => {
      const guild = await firstValueFrom(service.create(70, '2', 'Kirin Tor', null));
      await expectAsync(firstValueFrom(service.awardInSession('demo-session', '2', 999, 1, recipients))).toBeRejected();
      await expectAsync(firstValueFrom(service.awardInSession('demo-session', '2', guild.id, 1, []))).toBeRejected();
    });
  });
});
