import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CampaignFaction } from '../../../models/renown';
import { ParticipantView } from '../../../models/session';
import { NotificationService } from '../../../services/notification.service';
import { RenownService } from '../../../services/renown.service';
import { SessionService } from '../../../services/session.service';
import { RewardBarComponent } from './reward-bar.component';

describe('RewardBarComponent', () => {
  let fixture: ComponentFixture<RewardBarComponent>;
  let component: RewardBarComponent;
  let session: jasmine.SpyObj<SessionService>;
  let renown: jasmine.SpyObj<RenownService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  const seat = (participantId: number, name: string, over: Partial<ParticipantView> = {}): ParticipantView =>
    ({ participantId, pcId: participantId * 10, npc: false, name, clazz: 'Paladin', level: 5, ...over } as ParticipantView);
  const thalia = seat(1, 'Thalia');
  const brakk = seat(2, 'Brakk');
  const goblin = seat(3, 'Goblin', { npc: true, pcId: null, clazz: null, level: null });

  const kirinTor: CampaignFaction = { id: 3, parentId: null, name: 'Kirin Tor' };
  const covenant: CampaignFaction = { id: 4, parentId: null, name: 'Silver Covenant' };
  const wardens: CampaignFaction = { id: 5, parentId: 4, name: 'Wardens' };

  const element = (): HTMLElement => fixture.nativeElement;
  const giveButton = () => element().querySelector<HTMLButtonElement>('.reward-give')!;
  const names = () => Array.from(element().querySelectorAll('.reward-name')).map(n => n.textContent!.trim());

  beforeEach(() => {
    session = jasmine.createSpyObj<SessionService>('SessionService', ['awardXpToMany']);
    renown = jasmine.createSpyObj<RenownService>('RenownService', ['campaignFactions', 'awardInSession']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['notify', 'error']);
    renown.campaignFactions.and.returnValue(of([kirinTor, wardens, covenant]));
    TestBed.configureTestingModule({
      imports: [RewardBarComponent],
      providers: [
        { provide: SessionService, useValue: session },
        { provide: RenownService, useValue: renown },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    fixture = TestBed.createComponent(RewardBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sessionId', 7);
    fixture.componentRef.setInput('campaignId', 2);
    fixture.componentRef.setInput('participants', [thalia, goblin, brakk]);
    fixture.detectChanges();
  });

  it('lists the seated characters, never an enemy, all ticked', () => {
    expect(names()).toEqual(['Thalia', 'Brakk']);
    const boxes = Array.from(element().querySelectorAll<HTMLInputElement>('.reward-row input'));
    expect(boxes.every(b => b.checked)).toBeTrue();
    expect(element().querySelector('.reward-detail')!.textContent!.trim()).toBe('Paladin 5');
  });

  it('starts on XP with no faction picker and nothing to send', () => {
    expect(component.type()).toBe('xp');
    expect(element().querySelector('.reward-faction')).toBeNull();
    expect(renown.campaignFactions).not.toHaveBeenCalled();
    expect(giveButton().disabled).toBeTrue();
    expect(giveButton().textContent!.trim()).toBe('Reward 2 characters');
  });

  it('rewards XP to the ticked characters only, then empties the amount', () => {
    session.awardXpToMany.and.returnValue(of({ awarded: [{ pcId: 10, name: 'Thalia', xp: 550, delta: 50 }] }));
    component.toggle(2); // untick Brakk
    component.amount.set(50);
    fixture.detectChanges();
    expect(giveButton().textContent!.trim()).toBe('Reward 1 character');

    giveButton().click();

    expect(session.awardXpToMany).toHaveBeenCalledOnceWith(7, 50, [1]);
    expect(notifications.notify).toHaveBeenCalledOnceWith('Awarded 50 XP to 1 character');
    expect(component.amount()).toBeNull();
    expect(component.unticked().has(2)).toBeTrue(); // the ticks stay as they were
  });

  it('words a negative amount as a removal', () => {
    session.awardXpToMany.and.returnValue(of({ awarded: [
      { pcId: 10, name: 'Thalia', xp: 0, delta: -100 }, { pcId: 20, name: 'Brakk', xp: 0, delta: -100 }] }));
    component.amount.set(-100);
    component.give();
    expect(session.awardXpToMany).toHaveBeenCalledOnceWith(7, -100, [1, 2]);
    expect(notifications.notify).toHaveBeenCalledOnceWith('Removed 100 XP from 2 characters');
  });

  it('sends nothing without a whole, non-zero amount or with nobody ticked', () => {
    for (const amount of [null, 0, 2.5]) {
      component.amount.set(amount);
      expect(component.ready()).withContext(`amount ${amount}`).toBeFalse();
      component.give();
    }
    component.amount.set(50);
    component.clear();
    expect(component.ready()).toBeFalse();
    component.give();
    expect(session.awardXpToMany).not.toHaveBeenCalled();

    component.selectAll();
    expect(component.ready()).toBeTrue();
  });

  it('keeps the amount and ticks when the XP reward fails', () => {
    const failure = { status: 400, error: { message: 'A chosen character is no longer in this session' } };
    session.awardXpToMany.and.returnValue(throwError(() => failure));
    component.amount.set(50);
    component.give();
    expect(notifications.error).toHaveBeenCalledOnceWith('Could not reward the XP. Try again.', failure);
    expect(component.amount()).toBe(50);
    expect(component.busy()).toBeFalse();
  });

  it('does not send twice while a reward is on its way', () => {
    session.awardXpToMany.and.returnValue(new Subject());
    component.amount.set(50);
    component.give();
    component.give();
    expect(session.awardXpToMany).toHaveBeenCalledTimes(1);
  });

  it('ticks a character who joins later and drops one who leaves', () => {
    component.toggle(1); // Thalia unticked
    fixture.componentRef.setInput('participants', [thalia, seat(4, 'Mirelle')]);
    fixture.detectChanges();
    expect(names()).toEqual(['Thalia', 'Mirelle']);
    expect(component.ticked().map(p => p.name)).toEqual(['Mirelle']);
  });

  describe('renown', () => {
    beforeEach(() => {
      component.setType('renown');
      fixture.detectChanges();
    });

    it('reads the campaign factions and indents a subfaction under its parent', () => {
      expect(renown.campaignFactions).toHaveBeenCalledOnceWith(7, '2');
      const options = Array.from(element().querySelectorAll<HTMLOptionElement>('.reward-faction option'))
        .map(o => o.textContent);
      expect(options).toEqual(['Choose a faction', 'Kirin Tor', 'Silver Covenant', '    Wardens']);
    });

    it('needs a faction before it can send', () => {
      component.amount.set(2);
      expect(component.ready()).toBeFalse();
      component.factionId.set(3);
      expect(component.ready()).toBeTrue();
    });

    it('rewards the picked faction to the ticked characters', () => {
      renown.awardInSession.and.returnValue(of({ awarded: [{ pcId: 20, name: 'Brakk', score: 2, delta: 2 }] }));
      component.factionId.set(5);
      component.toggle(1);
      component.amount.set(2);
      component.give();
      expect(renown.awardInSession).toHaveBeenCalledOnceWith(7, '2', 5, 2,
        [{ participantId: 2, pcId: 20, name: 'Brakk' }]);
      expect(notifications.notify).toHaveBeenCalledOnceWith('Awarded 2 Wardens renown to 1 character');
      expect(component.amount()).toBeNull();
      expect(component.factionId()).toBe(5);
    });

    it('refuses more than 200 renown either way, the limit the server enforces', () => {
      component.factionId.set(3);
      component.amount.set(201);
      expect(component.ready()).toBeFalse();
      component.amount.set(-200);
      expect(component.ready()).toBeTrue();
    });

    it('rereads the factions on every switch to Renown and forgets a pick that is gone', () => {
      component.factionId.set(5);
      renown.campaignFactions.and.returnValue(of([kirinTor]));
      component.setType('xp');
      component.setType('renown');
      expect(renown.campaignFactions).toHaveBeenCalledTimes(2);
      expect(component.factionId()).toBeNull();
    });

    it('says so when the campaign has no factions', () => {
      renown.campaignFactions.and.returnValue(of([]));
      component.setType('renown');
      fixture.detectChanges();
      expect(element().querySelector('.reward-faction')).toBeNull();
      expect(element().querySelector('.reward-none')!.textContent!.trim())
        .toBe("No factions yet. Add one on a character's Renown tab.");
      component.amount.set(2);
      expect(component.ready()).toBeFalse();
    });

    it('reports a failed reward, keeps the amount and rereads the factions', () => {
      renown.awardInSession.and.returnValue(throwError(() => ({ status: 404 })));
      component.factionId.set(3);
      component.amount.set(2);
      component.give();
      expect(notifications.error).toHaveBeenCalledOnceWith('Could not reward the renown. Try again.', { status: 404 });
      expect(component.amount()).toBe(2);
      expect(renown.campaignFactions).toHaveBeenCalledTimes(2);
    });

    it('reports a failed faction read without showing the empty message', () => {
      renown.campaignFactions.and.returnValue(throwError(() => ({ status: 500 })));
      component.setType('renown');
      fixture.detectChanges();
      expect(notifications.error).toHaveBeenCalledOnceWith('Could not load the factions. Try again.', { status: 500 });
      expect(element().querySelector('.reward-none')).toBeNull();
    });
  });
});
