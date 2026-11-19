import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';
import { FollowerService } from './follower.service';
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
            { participantId: 5, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null },
            { participantId: 6, pcId: 8, displayName: 'Mira', ready: false, cannotRest: true, clazz: null, subclass: null, specialization: null, level: null },
          ],
        },
      }));

      expect(state!.longRest).toEqual({
        advanceClock: true, undisturbed: false, readyCount: 0, ableCount: 1,
        readiness: [
          { participantId: 5, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null },
          { participantId: 6, pcId: 8, displayName: 'Mira', ready: false, cannotRest: true, clazz: null, subclass: null, specialization: null, level: null },
        ],
        myChoices: null,
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

    it('a Ready carries the hero\'s choices; taking Ready back sends none', () => {
      service.setLongRestReady(1, 7, true, { preparedSpells: ['Bless', 'Aid'], runeWeapon: 'Maul' }).subscribe();
      const ready = httpMock.expectOne(`${base}/1/long-rest/ready`);
      expect(ready.request.body).toEqual({ pcId: 7, ready: true, preparedSpells: ['Bless', 'Aid'], runeWeapon: 'Maul' });
      ready.flush(snapshot());

      service.setLongRestReady(1, 7, false, { preparedSpells: ['Bless'] }).subscribe();
      const unready = httpMock.expectOne(`${base}/1/long-rest/ready`);
      expect(unready.request.body).toEqual({ pcId: 7, ready: false });
      unready.flush(snapshot());
    });

    it('reads back the choices the server is holding for this player', () => {
      let state: SessionState | undefined;
      service.setLongRestReady(1, 7, true, { preparedSpells: ['Bless'] }).subscribe(s => (state = s));
      httpMock.expectOne(`${base}/1/long-rest/ready`).flush(snapshot({
        longRest: { readiness: [], myChoices: { preparedSpells: ['Bless'], runeWeapon: null } },
      }));

      expect(state!.longRest!.myChoices).toEqual({ preparedSpells: ['Bless'] });
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

    it('reads the 24-hour wait, and the class details on a readiness row', () => {
      let state: SessionState | undefined;
      service.openLongRest(1).subscribe(s => (state = s));
      const longRestWait = {
        finishedTimeOfDay: 'morning', segmentsSince: 1, segmentsLeft: 1, availableTimeOfDay: 'night',
        availableTomorrow: false,
        reason: 'The party finished a long rest this morning. The next one can start tonight.',
      };
      httpMock.expectOne(`${base}/1/long-rest`).flush(snapshot({
        longRestAvailable: false,
        longRestWait,
        longRest: { readiness: [{
          participantId: 5, pcId: 7, displayName: 'Thorne', clazz: 'Paladin',
          subclass: 'Oath of the Ebon Blade', specialization: 'Frost', level: 5,
        }] },
      }));

      expect(state!.longRestAvailable).toBeFalse();
      expect(state!.longRestWait).toEqual(longRestWait as SessionState['longRestWait']);
      expect(state!.longRest!.readiness[0]).toEqual(jasmine.objectContaining({
        clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost', level: 5,
      }));
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
      expect(state!.longRestAvailable).toBeTrue(); // no 24-hour rule on an older backend
      expect(state!.longRestWait).toBeNull();
    });
  });

  describe('followers', () => {
    const wire = {
      followerId: 12, pcId: 7, name: 'Brannoc', clazz: 'Guard', level: 2,
      hpMax: 16, hpCurrent: 4, ac: 16, conditions: ['Prone'],
    };

    it('reads each participant\'s followers off the snapshot', () => {
      let state: SessionState | undefined;
      service.getState(1).subscribe(s => (state = s));
      httpMock.expectOne(`${base}/1/state`).flush(snapshot({
        participants: [{ participantId: 1, pcId: 7, name: 'Aria', followers: [wire] }],
      }));

      expect(state!.participants[0].followers).toEqual([{
        followerId: 12, pcId: 7, name: 'Brannoc', clazz: 'Guard', level: 2,
        portraitTint: null, portraitInitials: null,
        hpMax: 16, hpCurrent: 4, hpTemp: null, ac: 16, conditions: ['Prone'],
      }]);
    });

    it('defaults followers to [] when the backend predates them', () => {
      let state: SessionState | undefined;
      service.getState(1).subscribe(s => (state = s));
      httpMock.expectOne(`${base}/1/state`).flush(snapshot({
        participants: [
          { participantId: 1, pcId: 7, name: 'Aria' },
          { participantId: 2, name: 'Goblin', npc: true, followers: null },
        ],
      }));

      expect(state!.participants.map(p => p.followers)).toEqual([[], []]);
    });

    // How a player's Followers tab learns the DM granted one mid-session, and
    // how an open follower sheet learns it was hurt from the initiative order.
    describe('announced through FollowerService when a snapshot shows them changed', () => {
      let changed: number[];
      const poll = (...participants: unknown[]) => {
        service.getState(1).subscribe();
        httpMock.expectOne(`${base}/1/state`).flush(snapshot({ participants }));
      };
      const aria = (followers: unknown[]) => ({ participantId: 1, pcId: 7, name: 'Aria', followers });
      const throk = { participantId: 2, pcId: 8, name: 'Throk', followers: [] };

      beforeEach(() => {
        changed = [];
        TestBed.inject(FollowerService).changes$.subscribe(c => changed.push(c.pcId));
      });

      it('says nothing for the first snapshot, or for one that shows the same followers', () => {
        poll(aria([wire]), throk);
        poll(aria([wire]), throk);

        expect(changed).toEqual([]);
      });

      it("names the PC whose follower ids changed (a grant, then a dismissal)", () => {
        poll(aria([]), throk);

        poll(aria([wire]), throk);
        expect(changed).toEqual([7]);

        poll(aria([]), throk);
        expect(changed).toEqual([7, 7]);
      });

      it("names the PC whose follower was hurt", () => {
        poll(aria([wire]), throk);

        poll(aria([{ ...wire, hpCurrent: 1 }]), throk);

        expect(changed).toEqual([7]);
      });

      it('starts over after the session is cleared', () => {
        poll(aria([]), throk);
        service.clear();

        poll(aria([wire]), throk);

        expect(changed).toEqual([]);
      });
    });

    it('damageFollower POSTs the amount to the follower endpoint and publishes the snapshot', () => {
      let state: SessionState | undefined;
      service.damageFollower(1, 12, 5).subscribe(s => (state = s));

      const req = httpMock.expectOne(`${base}/1/followers/12/damage`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ amount: 5 });
      req.flush(snapshot({
        participants: [{ participantId: 1, pcId: 7, name: 'Aria', followers: [{ ...wire, hpCurrent: 0 }] }],
      }));

      expect(state!.participants[0].followers[0].hpCurrent).toBe(0);
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
        readiness: [{ participantId: 7, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false, clazz: 'Fighter', subclass: null, specialization: null, level: 5 }],
        myChoices: null,
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

    describe('choices', () => {
      const cleric = (over: Partial<PC> = {}): PC => hero({
        clazz: 'Cleric',
        spells: [
          { name: 'Bless', lvl: 1, prepared: true, school: 'Enchantment', time: '1 action' },
          { name: 'Command', lvl: 1, prepared: false, school: 'Enchantment', time: '1 action' },
        ],
        ...over,
      });

      const knight = (over: Partial<PC> = {}): PC => hero({
        id: 8, name: 'Thorne', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Blood',
        stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 16 },
        inventory: [
          { name: 'Greatsword', category: 'weapon', qty: 1 },
          { name: 'Maul', category: 'weapon', qty: 1 },
        ],
        ...over,
      });

      const preparedOf = (pc: PC): string[] => pc.spells!.filter(s => s.prepared).map(s => s.name);

      it('a ready hero\'s prepared list is applied when the rest finishes, not before', () => {
        seed([cleric(), hero({ id: 8, name: 'Mira' })]);
        service.openLongRest('demo-session').subscribe();
        service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();

        service.setLongRestReady('demo-session', 7, true, { preparedSpells: ['Command'] }).subscribe();
        expect(current().longRest!.myChoices).toEqual({ preparedSpells: ['Command'] });
        expect(preparedOf(store.get(7)!)).toEqual(['Bless']);

        service.finishLongRest('demo-session').subscribe();
        expect(preparedOf(store.get(7)!)).toEqual(['Command']);
      });

      it('taking Ready back discards the choices', () => {
        seed([cleric(), hero({ id: 8, name: 'Mira' })]);
        service.openLongRest('demo-session').subscribe();
        service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();
        service.setLongRestReady('demo-session', 7, true, { preparedSpells: ['Command'] }).subscribe();

        service.setLongRestReady('demo-session', 7, false).subscribe();
        expect(current().longRest!.myChoices).toBeNull();

        service.finishLongRest('demo-session').subscribe();
        expect(preparedOf(store.get(7)!)).toEqual(['Bless']); // rested, list untouched
        expect(store.get(7)!.hp!.cur).toBe(44);
      });

      it('interrupting leaves the choices unapplied', () => {
        seed([cleric(), hero({ id: 8, name: 'Mira' })]);
        service.openLongRest('demo-session').subscribe();
        service.setLongRestReady('demo-session', 7, true, { preparedSpells: ['Command'] }).subscribe();

        service.interruptLongRest('demo-session').subscribe();

        expect(preparedOf(store.get(7)!)).toEqual(['Bless']);
      });

      it('inscribes the rune, and a Blood Rune leaves temporary Hit Points', () => {
        seed([hero(), knight()]);
        service.openLongRest('demo-session').subscribe();
        service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();
        service.setLongRestReady('demo-session', 8, true, { runeWeapon: 'Maul' }).subscribe();

        service.finishLongRest('demo-session').subscribe();

        const rested = store.get(8)!;
        expect(rested.runeWeapon).toBe('Maul');
        expect(rested.hp!.temp).toBe(8); // the old 5 faded; +3 Charisma + level 5
        expect(current().participants[1].hpTemp).toBe(8);
      });

      it('a knight who did not ready keeps the rune where it was', () => {
        seed([hero(), knight({ runeWeapon: 'Greatsword' })]);
        service.openLongRest('demo-session').subscribe();
        service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();

        service.finishLongRest('demo-session').subscribe();

        expect(store.get(8)!.runeWeapon).toBe('Greatsword');
        expect(store.get(8)!.hp!.temp).toBe(8); // already inscribed, so the Blood Rune still gives
      });
    });

    describe('one long rest every 24 hours', () => {
      const clock = (timeOfDay: string) =>
        ({ year: '1', month: '1', day: '1', timeOfDay, weekday: null, week: 1 } as never);

      it('a finished rest starts the wait from the morning the clock walked to', () => {
        seed([hero()], { gameTime: clock('noon') });
        service.openLongRest('demo-session').subscribe();

        service.finishLongRest('demo-session').subscribe();

        expect(current().longRestAvailable).toBeFalse();
        expect(current().longRestWait!.reason)
          .toBe('The party finished a long rest this morning. The next one can start tonight.');
      });

      it('inside the wait neither the DM nor a long vote opens a rest, but a short vote still works', () => {
        seed([hero()], { gameTime: clock('noon') });
        service.openLongRest('demo-session').subscribe();
        service.finishLongRest('demo-session').subscribe();

        service.openLongRest('demo-session').subscribe();
        expect(current().longRest).toBeNull();
        service.initiateRestVote('demo-session', 'LONG').subscribe();
        expect(current().longRest).toBeNull();

        service.initiateRestVote('demo-session', 'SHORT').subscribe();
        expect(current().shortRestOpen).toBeTrue();
      });

      it('advancing the clock twice ends the wait', () => {
        seed([hero()], { gameTime: clock('noon') });
        service.openLongRest('demo-session').subscribe();
        service.finishLongRest('demo-session').subscribe();

        service.advanceTime('demo-session').subscribe();
        expect(current().longRestWait!.segmentsLeft).toBe(1);
        service.advanceTime('demo-session').subscribe();
        expect(current().longRestWait).toBeNull();
        expect(current().longRestAvailable).toBeTrue();

        service.openLongRest('demo-session').subscribe();
        expect(current().longRest).not.toBeNull();
      });

      it('an interrupted rest does not count, and neither does one on a clock nobody set', () => {
        seed([hero()], { gameTime: clock('noon') });
        service.openLongRest('demo-session').subscribe();
        service.interruptLongRest('demo-session').subscribe();
        expect(current().longRestAvailable).toBeTrue();

        seed([hero()]); // gameTime null
        service.openLongRest('demo-session').subscribe();
        service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();
        service.finishLongRest('demo-session').subscribe();
        expect(current().longRestWait).toBeNull();
      });
    });

    describe('class resources', () => {
      const fighter = (over: Partial<PC> = {}): PC => hero({
        clazz: 'Fighter', spellSlots: undefined, classResources: { secondWind: 2, actionSurge: 1 }, ...over,
      });

      it('opening a short rest gives back what the rules say; closing it gives nothing', () => {
        seed([fighter()]);

        service.shortRest('demo-session').subscribe();
        expect(current().shortRestOpen).toBeTrue();
        expect(store.get(7)!.classResources).toEqual({ secondWind: 1 }); // one use back; Action Surge all back

        service.shortRest('demo-session').subscribe();
        expect(current().shortRestOpen).toBeFalse();
        expect(store.get(7)!.classResources).toEqual({ secondWind: 1 });
      });

      it('a passed short rest vote gives the same recovery', () => {
        seed([fighter()]);

        service.initiateRestVote('demo-session', 'SHORT').subscribe();

        expect(store.get(7)!.classResources).toEqual({ secondWind: 1 });
      });

      it('a short rest restores a Warlock\'s Pact Magic slots on the sheet and the snapshot', () => {
        seed([hero({ clazz: 'Warlock', spellSlots: { 3: { max: 2, used: 2 } } })]);

        service.shortRest('demo-session').subscribe();

        expect(store.get(7)!.spellSlots).toEqual({ 3: { max: 2, used: 0 } });
        expect(current().participants[0].spellSlots).toEqual({ 3: { max: 2, used: 0 } });
      });

      it('finishing a long rest hands every resource back', () => {
        seed([fighter()]);
        service.openLongRest('demo-session').subscribe();
        service.setLongRestOptions('demo-session', { advanceClock: false }).subscribe();

        service.finishLongRest('demo-session').subscribe();

        expect(store.get(7)!.classResources).toEqual({});
      });
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
