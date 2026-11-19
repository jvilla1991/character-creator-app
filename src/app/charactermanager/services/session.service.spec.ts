import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';
import { ParticipantView, SessionState } from '../models/session';
import { PC } from '../models/pc';

// The rest vote and long rest phase: what goes over the wire, how the snapshot
// is read back, and the demo-mode mirrors.
describe('SessionService rests', () => {
  let service: SessionService;
  let httpMock: HttpTestingController;
  let campaignService: jasmine.SpyObj<CampaignService>;
  let pcService: jasmine.SpyObj<PCService>;
  const base = `${environment.characterApiUrl}/api/v1/session`;

  /** The smallest snapshot the deserializer accepts. */
  const snapshot = (over: Record<string, unknown> = {}) => ({
    sessionId: 1, campaignId: 2, status: 'LOBBY', round: 1, version: 3, ...over,
  });

  beforeEach(() => {
    campaignService = jasmine.createSpyObj<CampaignService>('CampaignService',
      ['getLocalCampaign', 'setLocalGameTime']);
    pcService = jasmine.createSpyObj<PCService>('PCService', ['getPCById', 'patchLocalPC']);
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        { provide: CampaignService, useValue: campaignService },
        { provide: PCService, useValue: pcService },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('over HTTP', () => {
    it('initiateRestVote POSTs the rest type, SHORT unless told otherwise', () => {
      service.initiateRestVote(1).subscribe();
      const short = httpMock.expectOne(`${base}/1/rest-vote`);
      expect(short.request.method).toBe('POST');
      expect(short.request.body).toEqual({ restType: 'SHORT' });
      short.flush(snapshot());

      service.initiateRestVote(1, 'LONG').subscribe();
      const long = httpMock.expectOne(`${base}/1/rest-vote`);
      expect(long.request.body).toEqual({ restType: 'LONG' });
      long.flush(snapshot());
    });

    it('openLongRest POSTs to /long-rest and publishes the phase', () => {
      let state: SessionState | undefined;
      service.openLongRest(1).subscribe(s => (state = s));

      const req = httpMock.expectOne(`${base}/1/long-rest`);
      expect(req.request.method).toBe('POST');
      req.flush(snapshot({
        longRest: {
          advanceClock: true, undisturbed: false, readyCount: 0, ableCount: 1,
          readiness: [
            { participantId: 5, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false },
            { participantId: 6, pcId: 8, displayName: 'Mira', ready: false, cannotRest: true },
          ],
        },
      }));

      expect(state!.longRest).toEqual({
        advanceClock: true, undisturbed: false, readyCount: 0, ableCount: 1,
        readiness: [
          { participantId: 5, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false },
          { participantId: 6, pcId: 8, displayName: 'Mira', ready: false, cannotRest: true },
        ],
      });
      let published: SessionState | null = null;
      service.state$.subscribe(s => (published = s));
      expect(published!.longRest).toEqual(state!.longRest);
    });

    it('setLongRestReady POSTs the hero and the flag', () => {
      service.setLongRestReady(1, 7, true).subscribe();
      const req = httpMock.expectOne(`${base}/1/long-rest/ready`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ pcId: 7, ready: true });
      req.flush(snapshot());
    });

    it('setLongRestOptions PUTs only the option that changed', () => {
      service.setLongRestOptions(1, { advanceClock: false }).subscribe();
      const req = httpMock.expectOne(`${base}/1/long-rest/options`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ advanceClock: false });
      req.flush(snapshot());
    });

    it('finishLongRest and interruptLongRest POST to their own routes', () => {
      service.finishLongRest(1).subscribe();
      const finish = httpMock.expectOne(`${base}/1/long-rest/finish`);
      expect(finish.request.method).toBe('POST');
      finish.flush(snapshot());

      service.interruptLongRest(1).subscribe();
      const interrupt = httpMock.expectOne(`${base}/1/long-rest/interrupt`);
      expect(interrupt.request.method).toBe('POST');
      interrupt.flush(snapshot());
    });

    it('reads the long rest outcome, and the rest type on a vote', () => {
      let state: SessionState | undefined;
      service.finishLongRest(1).subscribe(s => (state = s));
      httpMock.expectOne(`${base}/1/long-rest/finish`).flush(snapshot({
        restVote: {
          voteId: 10, status: 'PASSED', restType: 'LONG', initiatorName: 'Bex',
          expiresAt: '2026-01-01T00:00:00Z', votes: [],
        },
        longRestResult: { id: 77, outcome: 'FINISHED', skipped: ['Mira'], clockAdvanced: true,
          createdAt: '2026-01-01T00:00:00Z' },
      }));

      expect(state!.restVote!.restType).toBe('LONG');
      expect(state!.longRest).toBeNull();
      expect(state!.longRestResult).toEqual({
        id: 77, outcome: 'FINISHED', skipped: ['Mira'], clockAdvanced: true,
        createdAt: '2026-01-01T00:00:00Z',
      });
    });

    it('a snapshot from a backend that predates the long rest still reads cleanly', () => {
      let state: SessionState | undefined;
      service.initiateRestVote(1).subscribe(s => (state = s));
      httpMock.expectOne(`${base}/1/rest-vote`).flush(snapshot({
        restVote: { voteId: 10, status: 'ACTIVE', initiatorName: 'Bex',
          expiresAt: '2026-01-01T00:00:00Z', votes: [] },
      }));

      expect(state!.restVote!.restType).toBe('SHORT');
      expect(state!.longRest).toBeNull();
      expect(state!.longRestResult).toBeNull();
    });
  });

  describe('demo mode', () => {
    const hero = (over: Partial<PC> = {}): PC => ({
      id: 7, name: 'Bex', clazz: 'Fighter', level: 5,
      hp: { cur: 18, max: 44, temp: 5 },
      hitDiceUsed: 4,
      exhaustion: 2,
      spellSlots: { 1: { max: 2, used: 2 } },
      ...over,
    } as PC);

    const seat = (pc: PC): ParticipantView => ({
      participantId: pc.id, pcId: pc.id, npc: false, ownedByMe: true, name: pc.name,
      hpCurrent: pc.hp!.cur, hpMax: pc.hp!.max, hpTemp: pc.hp!.temp,
      hitDiceUsed: pc.hitDiceUsed ?? null, spellSlots: pc.spellSlots ?? null, survival: null,
    } as ParticipantView);

    let store: Map<number, PC>;

    /** Seed the in-memory session with these heroes seated. */
    function seed(pcs: PC[], over: Partial<SessionState> = {}): void {
      store = new Map(pcs.map(p => [p.id, p]));
      pcService.getPCById.and.callFake((id: number) => store.get(id));
      pcService.patchLocalPC.and.callFake((id: number, patch: Partial<PC>) => {
        store.set(id, { ...store.get(id)!, ...patch });
      });
      (service as unknown as { pushState(s: SessionState): void }).pushState({
        sessionId: 'demo-session', campaignId: 'c1', status: 'LOBBY', round: 1, version: 0, dm: true,
        shortRestOpen: false, gameTime: null, participants: pcs.map(seat), rolls: [],
        restVote: null, lootResult: null, longRest: null, longRestResult: null,
        ...over,
      } as SessionState);
    }

    const current = (): SessionState => {
      let s: SessionState | null = null;
      service.state$.subscribe(v => (s = v));
      return s!;
    };

    beforeEach(() => {
      spyOnProperty(environment, 'demoMode', 'get').and.returnValue(true);
      campaignService.getLocalCampaign.and.returnValue(undefined);
    });

    it('a short vote opens the hit-dice window; a long vote opens the long rest phase', () => {
      seed([hero()]);
      service.initiateRestVote('demo-session').subscribe();
      expect(current().restVote!.restType).toBe('SHORT');
      expect(current().shortRestOpen).toBeTrue();
      expect(current().longRest).toBeNull();

      seed([hero()]);
      service.initiateRestVote('demo-session', 'LONG').subscribe();
      expect(current().restVote!.restType).toBe('LONG');
      expect(current().shortRestOpen).toBeFalse();
      expect(current().longRest!.readiness.map(r => r.displayName)).toEqual(['Bex']);
      expect(current().longRest!.readyCount).toBe(0);
    });

    it('opening the phase recovers nothing', () => {
      seed([hero()], { shortRestOpen: true });

      service.openLongRest('demo-session').subscribe();

      expect(current().longRest).toEqual({
        advanceClock: true, undisturbed: true, readyCount: 0, ableCount: 1,
        readiness: [{ participantId: 7, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false }],
      });
      expect(current().shortRestOpen).toBeFalse();
      expect(pcService.patchLocalPC).not.toHaveBeenCalled();
    });

    it('options change on the phase without ending it', () => {
      seed([hero()]);
      service.openLongRest('demo-session').subscribe();

      service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();

      expect(current().longRest!.advanceClock).toBeFalse();
      expect(current().longRest!.undisturbed).toBeTrue();
    });

    it('finishing restores every seated hero and announces the outcome', () => {
      seed([hero()]);
      service.openLongRest('demo-session').subscribe();
      service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();

      service.finishLongRest('demo-session').subscribe();

      const rested = store.get(7)!;
      expect(rested.hp).toEqual({ cur: 44, max: 44, temp: 0 });
      expect(rested.hitDiceUsed).toBe(0);           // all of them, not half
      expect(rested.exhaustion).toBe(1);
      expect(rested.spellSlots![1].used).toBe(0);
      expect(current().longRest).toBeNull();
      expect(current().longRestResult!.outcome).toBe('FINISHED');
      expect(current().longRestResult!.skipped).toEqual([]);
      expect(current().participants[0].hpCurrent).toBe(44);
      expect(current().participants[0].hitDiceUsed).toBe(0);
    });

    it('the last Ready finishes the rest; an earlier one only counts', () => {
      seed([hero(), hero({ id: 8, name: 'Mira' })]);
      service.openLongRest('demo-session').subscribe();
      service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();

      service.setLongRestReady('demo-session', 7, true).subscribe();
      expect(current().longRest!.readyCount).toBe(1);
      expect(store.get(7)!.hp!.cur).toBe(18);

      service.setLongRestReady('demo-session', 8, true).subscribe();
      expect(current().longRest).toBeNull();
      expect(store.get(7)!.hp!.cur).toBe(44);
      expect(store.get(8)!.hp!.cur).toBe(44);
    });

    it('a hero at 0 Hit Points is skipped and named', () => {
      seed([hero(), hero({ id: 8, name: 'Mira', hp: { cur: 0, max: 30, temp: 0 } })]);
      service.openLongRest('demo-session').subscribe();
      expect(current().longRest!.ableCount).toBe(1);
      expect(current().longRest!.readiness[1].cannotRest).toBeTrue();
      service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();

      service.finishLongRest('demo-session').subscribe();

      expect(store.get(8)!.hp!.cur).toBe(0);
      expect(store.get(8)!.hitDiceUsed).toBe(4);
      expect(current().longRestResult!.skipped).toEqual(['Mira']);
    });

    it('with the clock on, finishing walks it to the next morning', () => {
      seed([hero()], {
        gameTime: { year: '1', month: '1', day: '1', timeOfDay: 'noon', weekday: null, week: 1 } as never,
      });
      service.openLongRest('demo-session').subscribe();

      service.finishLongRest('demo-session').subscribe();

      expect(current().gameTime!.timeOfDay).toBe('morning');
      expect(current().gameTime!.day).toBe('2');
      expect(current().longRestResult!.clockAdvanced).toBeTrue();
    });

    it('interrupting closes the phase and nobody recovers', () => {
      seed([hero()]);
      service.openLongRest('demo-session').subscribe();

      service.interruptLongRest('demo-session').subscribe();

      expect(current().longRest).toBeNull();
      expect(current().longRestResult!.outcome).toBe('INTERRUPTED');
      expect(store.get(7)!.hp!.cur).toBe(18);
      expect(pcService.patchLocalPC).not.toHaveBeenCalled();
    });
  });
});
