import { signal, Signal, WritableSignal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { DiceRollerService } from './dice-roller.service';
import { PCService } from './pc.service';
import { SessionService } from './session.service';
import { UiStateService } from './ui-state.service';
import { PC } from '../models/pc';
import { ParticipantView, SessionState } from '../models/session';

// Class-only tests (no TestBed): stubbed collaborators, matching the house
// style. The UiState stub keeps a real signal so `isOpen` behaves.
describe('DiceRollerService', () => {
  let diceOpen: WritableSignal<boolean>;
  let uiState: { diceOpen: Signal<boolean>; openDice: jasmine.Spy; closeDice: jasmine.Spy };
  let pcService: jasmine.SpyObj<PCService>;
  let sessionService: { state$: unknown; getActiveForCampaign: jasmine.Spy };
  let service: DiceRollerService;

  const seat = (over: Partial<ParticipantView> = {}): ParticipantView =>
    ({ participantId: 11, pcId: 7, ownedByMe: true, ...over } as ParticipantView);

  const live = (over: Partial<SessionState> = {}): SessionState =>
    ({ sessionId: 42, status: 'ACTIVE', participants: [seat()], ...over } as SessionState);

  const aria = { id: 7, name: 'Aria', campaignId: 3 } as PC;

  /** Rebuilds the service so each test can stage its own ambient state. */
  const create = (): DiceRollerService =>
    new DiceRollerService(uiState as never, pcService, sessionService as never);

  beforeEach(() => {
    diceOpen = signal(false);
    uiState = {
      diceOpen: diceOpen.asReadonly(),
      openDice: jasmine.createSpy('openDice').and.callFake(() => diceOpen.set(true)),
      closeDice: jasmine.createSpy('closeDice').and.callFake(() => diceOpen.set(false)),
    };
    pcService = jasmine.createSpyObj<PCService>('PCService', ['getActivePC', 'getPCById']);
    pcService.getActivePC.and.returnValue(of(aria));
    pcService.getPCById.and.returnValue(aria);
    sessionService = {
      state$: of(null),
      getActiveForCampaign: jasmine.createSpy('getActiveForCampaign').and.returnValue(of(null)),
    };
    service = create();
  });

  describe('open / close', () => {
    it('opens and closes the shell overlay', () => {
      service.open();

      expect(uiState.openDice).toHaveBeenCalled();
      expect(service.isOpen()).toBeTrue();

      service.close();

      expect(uiState.closeDice).toHaveBeenCalled();
      expect(service.isOpen()).toBeFalse();
    });
  });

  describe('context: Session Mode is open', () => {
    it("takes the player's seat straight off the live snapshot", () => {
      sessionService.state$ = of(live());
      service = create();

      service.open();

      expect(service.sessionId()).toBe(42);
      expect(service.participantId()).toBe(11);
      expect(service.pc()).toBe(aria);
      // The ambient snapshot is authoritative — no need to ask the backend.
      expect(sessionService.getActiveForCampaign).not.toHaveBeenCalled();
    });

    it('leaves a DM (who holds no seat) unlogged, so their rolls stay private', () => {
      sessionService.state$ = of(live({ participants: [seat({ ownedByMe: false })] }));
      service = create();

      service.open();

      expect(service.sessionId()).toBeNull();
      expect(service.participantId()).toBeNull();
      expect(sessionService.getActiveForCampaign).not.toHaveBeenCalled();
    });

    it('falls back to the campaign lookup once the session has ENDED', () => {
      sessionService.state$ = of(live({ status: 'ENDED' }));
      service = create();

      service.open();

      expect(sessionService.getActiveForCampaign).toHaveBeenCalledWith('3');
    });
  });

  describe('context: no Session Mode on screen', () => {
    it("wires the roll to the active PC's live session when it is seated there", () => {
      sessionService.getActiveForCampaign.and.returnValue(of(live()));

      service.open();

      expect(sessionService.getActiveForCampaign).toHaveBeenCalledWith('3');
      expect(service.sessionId()).toBe(42);
      expect(service.participantId()).toBe(11);
      expect(service.pc()).toBe(aria);
    });

    it('keeps the roll private when no session is live', () => {
      sessionService.getActiveForCampaign.and.returnValue(of(null));

      service.open();

      expect(service.sessionId()).toBeNull();
      expect(service.participantId()).toBeNull();
      expect(service.pc()).toBe(aria);   // still personalises the title
    });

    it('keeps the roll private when the PC is in the session but not this seat', () => {
      sessionService.getActiveForCampaign.and.returnValue(
        of(live({ participants: [seat({ pcId: 99 })] })));

      service.open();

      expect(service.participantId()).toBeNull();
    });

    it('skips the lookup entirely for a PC in no campaign', () => {
      pcService.getActivePC.and.returnValue(of({ id: 7, name: 'Aria' } as PC));

      service.open();

      expect(sessionService.getActiveForCampaign).not.toHaveBeenCalled();
      expect(service.sessionId()).toBeNull();
    });

    it('opens with no character at all', () => {
      pcService.getActivePC.and.returnValue(of(null));

      service.open();

      expect(service.pc()).toBeNull();
      expect(sessionService.getActiveForCampaign).not.toHaveBeenCalled();
    });
  });

  describe('stale lookups', () => {
    it('ignores a response that lands after the roller was reopened', () => {
      const slow = new Subject<SessionState | null>();
      sessionService.getActiveForCampaign.and.returnValue(slow);

      service.open();                      // first open: lookup in flight
      service.close();
      sessionService.getActiveForCampaign.and.returnValue(of(null));
      service.open();                      // reopened — the first answer is stale now
      slow.next(live());

      expect(service.sessionId()).toBeNull();
      expect(service.participantId()).toBeNull();
    });

    it('re-resolves on every open, so a session started mid-sheet is picked up', () => {
      sessionService.getActiveForCampaign.and.returnValue(of(null));
      service.open();
      expect(service.sessionId()).toBeNull();

      // The DM starts a session while the player sits on their sheet.
      sessionService.getActiveForCampaign.and.returnValue(of(live()));
      service.close();
      service.open();

      expect(service.sessionId()).toBe(42);
      expect(service.participantId()).toBe(11);
    });
  });
});
