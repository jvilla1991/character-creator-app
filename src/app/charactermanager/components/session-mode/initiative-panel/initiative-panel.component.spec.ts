import { InitiativePanelComponent } from './initiative-panel.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { SessionService } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { FollowerCombatant, ParticipantView, SessionState } from '../../../models/session';
import { ConfirmService } from '../../modal/confirm.service';
import { of, throwError } from 'rxjs';

// Class-only test (no TestBed/DOM). The per-device cue settings (isMuted,
// cueVolume, customCue) are read in the ctor, so the spy must stub them even
// though most tests below never touch sound.
describe('InitiativePanelComponent', () => {
  let component: InitiativePanelComponent;
  let sessionService: jasmine.SpyObj<SessionService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService',
      ['isMuted', 'cueVolume', 'customCue', 'setCueVolume', 'setCustomCue', 'playCue', 'leave', 'setInitiative',
        'damageFollower']);
    sessionService.isMuted.and.returnValue(false);
    sessionService.cueVolume.and.returnValue(1);
    sessionService.customCue.and.returnValue(null);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify', 'error']);
    component = TestBed.runInInjectionContext(() => new InitiativePanelComponent(sessionService, notifications));
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
    followers: [],
    ...overrides,
  });

  // --- turnAnnouncement (hidden status line) ---

  describe('turnAnnouncement', () => {
    const aria = participant({ participantId: 1, name: 'Aria' });
    const goblin = participant({ participantId: 2, name: 'Goblin', npc: true, pcId: null });

    beforeEach(() => {
      component.status = 'ACTIVE';
      component.participants = [aria, goblin];
    });

    it('names whose turn it is and who is on deck', () => {
      component.activeParticipantId = 1;
      component.onDeckParticipantId = 2;
      expect(component.turnAnnouncement).toBe("Aria's turn. Goblin is on deck.");
    });

    it('drops the on-deck clause when nobody visible is on deck', () => {
      component.activeParticipantId = 2;
      component.onDeckParticipantId = null;
      expect(component.turnAnnouncement).toBe("Goblin's turn.");
    });

    it("says nothing when the active combatant is not in this viewer's rows (a hidden enemy)", () => {
      component.activeParticipantId = 99;
      component.onDeckParticipantId = 1;
      expect(component.turnAnnouncement).toBe('');
    });

    it('says nothing in the lobby', () => {
      component.status = 'LOBBY';
      component.activeParticipantId = 1;
      expect(component.turnAnnouncement).toBe('');
    });
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

  describe('removing a combatant', () => {
    let confirm: jasmine.Spy;
    beforeEach(() => {
      component.sessionId = 3;
      sessionService.leave.and.returnValue(of({} as SessionState));
      confirm = spyOn(TestBed.inject(ConfirmService), 'confirm').and.returnValue(of(undefined));
    });

    it('asks before removing a player character, and Cancel keeps them', () => {
      confirm.and.returnValue(of());
      component.removeParticipant(participant({ name: 'Aria' }));
      expect(confirm).toHaveBeenCalledWith(jasmine.objectContaining({ subject: 'Aria' }));
      expect(sessionService.leave).not.toHaveBeenCalled();
    });

    it('removes the player character once confirmed', () => {
      component.removeParticipant(participant());
      expect(sessionService.leave).toHaveBeenCalledWith(3, 1);
    });

    it('removes an enemy without asking', () => {
      component.removeParticipant(participant({ npc: true, pcId: null }));
      expect(confirm).not.toHaveBeenCalled();
      expect(sessionService.leave).toHaveBeenCalledWith(3, 1);
    });
  });

  // --- followers: nested under their owner, sharing its turn ---

  describe('followers', () => {
    const follower = (overrides: Partial<FollowerCombatant> = {}): FollowerCombatant => ({
      followerId: 12, pcId: 7, name: 'Brannoc', clazz: 'Guard', level: 2,
      portraitTint: null, portraitInitials: null,
      hpMax: 16, hpCurrent: 4, hpTemp: null, ac: 16, conditions: ['Prone'],
      ...overrides,
    });

    let fixture: ComponentFixture<InitiativePanelComponent>;
    const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const followerRows = (): HTMLElement[] =>
      Array.from(element().querySelectorAll<HTMLElement>('.board-row.follower'));

    /** Aria (with Brannoc), then a goblin; rendered for a DM or a player. */
    async function render(dm: boolean): Promise<void> {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [InitiativePanelComponent],
        providers: [
          { provide: SessionService, useValue: sessionService },
          { provide: NotificationService, useValue: notifications },
        ],
      });
      fixture = TestBed.createComponent(InitiativePanelComponent);
      const panel = fixture.componentInstance;
      panel.sessionId = 3;
      panel.dm = dm;
      panel.status = 'ACTIVE';
      panel.participants = [
        participant({ participantId: 1, name: 'Aria', followers: [follower()] }),
        participant({ participantId: 2, name: 'Goblin', npc: true, pcId: null }),
      ];
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it("renders a PC's followers directly under the owner, with no initiative of their own", async () => {
      await render(false);

      const rows = Array.from(element().querySelectorAll<HTMLElement>('.board-row.member'));
      expect(rows.map(r => r.querySelector('.board-hero-name')!.textContent)).toEqual(['Aria', 'Brannoc', 'Goblin']);
      const row = followerRows()[0];
      expect(row.querySelector('.nest-crest')!.textContent).toBe('↳');
      expect(row.querySelector('.init-cell')!.textContent).toContain("Acts on Aria's turn");
      expect(row.querySelector('.init-input')).toBeNull();
      expect(row.querySelector('.hp-text')!.textContent).toContain('4/16');
      expect(row.querySelector('.ac-cell')!.textContent).toContain('16');
      expect(row.querySelector('.board-cond')!.textContent).toBe('Prone');
    });

    it('players see follower rows read-only', async () => {
      await render(false);

      expect(followerRows()[0].querySelector('.dm-adjust')).toBeNull();
      expect(followerRows()[0].querySelector('input')).toBeNull();
    });

    it('the DM gets a damage/heal box on a follower row and nothing else', async () => {
      await render(true);

      const adjust = followerRows()[0].querySelector('.dm-adjust')!;
      expect(adjust.querySelectorAll('input').length).toBe(1);
      expect(Array.from(adjust.querySelectorAll('button')).map(b => b.textContent)).toEqual(['−', '+']);
      expect(adjust.querySelector('.insp-pips')).toBeNull();
    });

    it("the DM's damage button calls the follower endpoint and clears the box", async () => {
      await render(true);
      sessionService.damageFollower.and.returnValue(of({} as SessionState));
      fixture.componentInstance.followerAmounts[12] = 5;

      followerRows()[0].querySelector<HTMLButtonElement>('.btn-mini.dmg')!.click();

      expect(sessionService.damageFollower).toHaveBeenCalledOnceWith(3, 12, 5);
      expect(fixture.componentInstance.followerAmounts[12]).toBeNull();
    });

    it('healing sends a negative amount; an empty box sends nothing', () => {
      component.sessionId = 3;
      sessionService.damageFollower.and.returnValue(of({} as SessionState));

      component.adjustFollowerHp(follower(), -1);
      expect(sessionService.damageFollower).not.toHaveBeenCalled();

      component.followerAmounts[12] = 4;
      component.adjustFollowerHp(follower(), -1);
      expect(sessionService.damageFollower).toHaveBeenCalledOnceWith(3, 12, -4);
    });

    it('a failed follower damage keeps the amount and says so', () => {
      component.sessionId = 3;
      sessionService.damageFollower.and.returnValue(throwError(() => ({ status: 500 })));
      component.followerAmounts[12] = 5;

      component.adjustFollowerHp(follower(), 1);

      expect(component.followerAmounts[12]).toBe(5);
      expect(notifications.error).toHaveBeenCalledWith('Could not damage Brannoc. Try again.', jasmine.anything());
    });

    it("the owner's toggle collapses and expands its followers", async () => {
      await render(false);
      const toggles = element().querySelectorAll<HTMLButtonElement>('.nest-toggle');
      expect(toggles.length).toBe(1);   // the goblin has no followers, so no toggle
      expect(toggles[0].getAttribute('aria-expanded')).toBe('true');

      toggles[0].click();
      fixture.detectChanges();
      expect(followerRows().length).toBe(0);
      expect(toggles[0].getAttribute('aria-expanded')).toBe('false');

      toggles[0].click();
      fixture.detectChanges();
      expect(followerRows().length).toBe(1);
    });

    it('a follower granted mid-session unfolds its collapsed owner; an unchanged snapshot does not', () => {
      const snapshot = (...followers: FollowerCombatant[]) => {
        component.participants = [participant({ participantId: 1, followers })];
        component.ngOnChanges({ participants: new SimpleChange(null, component.participants, false) });
      };
      snapshot(follower());
      component.toggleFollowers(component.participants[0]);

      snapshot(follower({ hpCurrent: 1 }));   // same follower, hurt
      expect(component.collapsed.has(1)).toBeTrue();

      snapshot(follower(), follower({ followerId: 13, name: 'Wren' }));
      expect(component.collapsed.has(1)).toBeFalse();
    });

    it("follower rows carry a softer copy of the owner's turn glow", async () => {
      await render(false);
      fixture.componentInstance.activeParticipantId = 1;
      fixture.detectChanges();
      expect(followerRows()[0].classList).toContain('with-current-turn');
      expect(followerRows()[0].classList).not.toContain('current-turn');

      fixture.componentInstance.activeParticipantId = 2;
      fixture.componentInstance.onDeckParticipantId = 1;
      fixture.detectChanges();
      expect(followerRows()[0].classList).toContain('with-on-deck');
      expect(followerRows()[0].classList).not.toContain('with-current-turn');
    });
  });

  it('a failed initiative save puts the box back and says so', () => {
    component.sessionId = 3;
    sessionService.setInitiative.and.returnValue(throwError(() => ({ status: 500 })));
    const field = document.createElement('input');
    field.value = '19';
    component.onInitiative(participant({ name: 'Aria', initRolled: true, initiative: 12 }), '19', field);
    expect(field.value).toBe('12');
    expect(notifications.error).toHaveBeenCalledWith("Could not set Aria's initiative. Try again.", jasmine.anything());
  });
});
