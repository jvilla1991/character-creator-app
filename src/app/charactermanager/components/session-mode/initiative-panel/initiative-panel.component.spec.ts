import { InitiativePanelComponent } from './initiative-panel.component';
import { SessionService } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { ParticipantView } from '../../../models/session';

// Class-only test (no TestBed/DOM). SessionService.isMuted is called from the
// ctor, so the spy must stub it even though most tests below never touch it.
describe('InitiativePanelComponent', () => {
  let component: InitiativePanelComponent;
  let sessionService: jasmine.SpyObj<SessionService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['isMuted']);
    sessionService.isMuted.and.returnValue(false);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify']);
    component = new InitiativePanelComponent(sessionService, notifications);
  });

  const participant = (overrides: Partial<ParticipantView> = {}): ParticipantView => ({
    participantId: 1,
    pcId: 7,
    npc: false,
    ownedByMe: false,
    currentTurn: false,
    name: 'Aria',
    clazz: 'Bard',
    level: 3,
    portraitTint: null,
    portraitInitials: null,
    initiative: null,
    initRolled: false,
    orderIndex: 0,
    hpMax: 20,
    hpCurrent: 20,
    hpTemp: null,
    ac: 14,
    conditions: [],
    survival: null,
    spellSlots: null,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    hitDiceUsed: null,
    inspirationPips: null,
    heroicInspiration: null,
    ...overrides,
  });

  // --- canOpenSheet ---

  describe('canOpenSheet', () => {
    it('is false for a non-DM viewer', () => {
      component.dm = false;
      expect(component.canOpenSheet(participant())).toBeFalse();
    });

    it('is false for an NPC row', () => {
      component.dm = true;
      expect(component.canOpenSheet(participant({ npc: true }))).toBeFalse();
    });

    it('is false when the row has no pcId', () => {
      component.dm = true;
      expect(component.canOpenSheet(participant({ pcId: null }))).toBeFalse();
    });

    it('is true for a DM viewing a PC row', () => {
      component.dm = true;
      expect(component.canOpenSheet(participant())).toBeTrue();
    });
  });

  // --- onHeroClick ---

  describe('onHeroClick', () => {
    it('emits openPc when allowed', () => {
      component.dm = true;
      const p = participant();
      const emitted = jasmine.createSpy('emitted');
      component.openPc.subscribe(emitted);

      component.onHeroClick(p);

      expect(emitted).toHaveBeenCalledWith(p);
    });

    it('does not emit when not allowed (non-DM)', () => {
      component.dm = false;
      const emitted = jasmine.createSpy('emitted');
      component.openPc.subscribe(emitted);

      component.onHeroClick(participant());

      expect(emitted).not.toHaveBeenCalled();
    });

    it('does not emit for an NPC row even as DM', () => {
      component.dm = true;
      const emitted = jasmine.createSpy('emitted');
      component.openPc.subscribe(emitted);

      component.onHeroClick(participant({ npc: true }));

      expect(emitted).not.toHaveBeenCalled();
    });

    it('does not emit when pcId is null', () => {
      component.dm = true;
      const emitted = jasmine.createSpy('emitted');
      component.openPc.subscribe(emitted);

      component.onHeroClick(participant({ pcId: null }));

      expect(emitted).not.toHaveBeenCalled();
    });
  });
});
