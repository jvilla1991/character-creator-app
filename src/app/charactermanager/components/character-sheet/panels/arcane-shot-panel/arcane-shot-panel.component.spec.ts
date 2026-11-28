import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ArcaneShotPanelComponent } from './arcane-shot-panel.component';
import { PCService } from '../../../../services/pc.service';
import { NotificationService } from '../../../../services/notification.service';
import { PC } from '../../../../models/pc';

describe('ArcaneShotPanelComponent', () => {
  let pcService: jasmine.SpyObj<PCService>;
  let notifications: jasmine.SpyObj<NotificationService>;
  let fixture: ComponentFixture<ArcaneShotPanelComponent>;
  let emitted: PC[];

  /** A Fighter 7 Arcane Archer in a campaign: Intelligence 16 (+3), Proficiency Bonus +3, all three options chosen. */
  const makeArcher = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Vess', clazz: 'Fighter', subclass: 'Arcane Archer', level: 7, playerName: 'Ben', campaignId: 3,
    stats: { STR: 10, DEX: 18, CON: 14, INT: 16, WIS: 12, CHA: 8 }, prof: 3,
    subclassChoices: { skills: [], arcaneShots: ['Banishing Shot', 'Bursting Shot', 'Shadow Shot'] },
    ...over,
  });
  /** The same archer two options short of nothing: it knows two of the three its level gives. */
  const shortArcher = (over: Partial<PC> = {}): PC =>
    makeArcher({ subclassChoices: { skills: [], arcaneShots: ['Banishing Shot', 'Shadow Shot'] }, ...over });

  type Viewer = { canEdit?: boolean; asDm?: boolean; choosable?: boolean };
  const OWNER: Viewer = { canEdit: true };
  const DM: Viewer = { canEdit: true, asDm: true };

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['setSubclassChoices']);
    pcService.setSubclassChoices.and.callFake((id, choices) => of(makeArcher({ subclassChoices: { skills: [], ...choices } })));
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['error']);
    TestBed.configureTestingModule({
      providers: [
        { provide: PCService, useValue: pcService },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    emitted = [];
  });

  function render(pc: PC, viewer: Viewer = {}): HTMLElement {
    fixture = TestBed.createComponent(ArcaneShotPanelComponent);
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('canEdit', viewer.canEdit ?? false);
    fixture.componentRef.setInput('asDm', viewer.asDm ?? false);
    fixture.componentRef.setInput('choosable', viewer.choosable ?? true);
    fixture.componentInstance.pcChange.subscribe(p => emitted.push(p));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const texts = (selector: string) => Array.from(el().querySelectorAll(selector)).map(text);
  const cards = () => Array.from(el().querySelectorAll('.shot-card')).map(card => [
    text(card.querySelector('.shot-card-name')), text(card.querySelector('.shot-card-damage')),
    card.querySelector('.shot-card-save') ? text(card.querySelector('.shot-card-save')) : null,
  ]);
  const chooseButton = () => el().querySelector('[data-choose]') as HTMLButtonElement | null;
  const saveButton = () => el().querySelector('[data-save]') as HTMLButtonElement;
  const boxes = () => Array.from(el().querySelectorAll('app-arcane-shot-picker input')) as HTMLInputElement[];
  const box = (name: string) => (Array.from(el().querySelectorAll('app-arcane-shot-picker .shot-option')) as HTMLElement[])
    .find(row => text(row.querySelector('.shot-name')) === name)!.querySelector('input') as HTMLInputElement;
  function tick(name: string): void {
    box(name).click();
    fixture.detectChanges();
  }
  function click(button: HTMLElement | null): void {
    button!.click();
    fixture.detectChanges();
  }
  function update(pc: PC): void {
    fixture.componentRef.setInput('pc', pc);
    fixture.detectChanges();
  }

  it('renders nothing for a character without Arcane Shots', () => {
    for (const pc of [
      makeArcher({ subclass: 'Champion' }), makeArcher({ subclass: undefined }), makeArcher({ level: 2 }),
      makeArcher({ clazz: 'Wizard' }), makeArcher({ clazz: 'Ranger', subclass: 'Hunter' }),
    ]) {
      expect(render(pc, DM).children.length).withContext(`${pc.clazz} ${pc.subclass} ${pc.level}`).toBe(0);
    }
  });

  describe('the cards', () => {
    it('show each known option with its damage at the character\'s level and its save with the DC', () => {
      render(makeArcher());
      expect(text(el().querySelector('.panel-title'))).toBe('Arcane Shot');
      // 8 + Intelligence modifier 3 + Proficiency Bonus 3.
      expect(cards()).toEqual([
        ['Banishing Shot', '1d6 Psychic', 'Charisma save, DC 14'],
        ['Bursting Shot', '2d6 Force', null],
        ['Shadow Shot', '1d6 Psychic', 'Wisdom save, DC 14'],
      ]);
      expect(texts('.shot-card-desc').every(summary => summary.length > 40)).toBeTrue();
      expect(text(el().querySelector('[data-die]'))).toBe('d6');
      expect(text(el().querySelector('[data-dc]'))).toBe('14');
      expect(el().querySelector('.shot-missing')).toBeNull();
    });

    it('move with the Fighter level: the die grows at 10, 15 and 18', () => {
      render(makeArcher());
      const dice: [number, string, string][] = [[9, 'd6', '2d6 Force'], [10, 'd8', '2d8 Force'], [14, 'd8', '2d8 Force'],
        [15, 'd10', '2d10 Force'], [17, 'd10', '2d10 Force'], [18, 'd12', '2d12 Force'], [20, 'd12', '2d12 Force']];
      for (const [level, die, damage] of dice) {
        update(makeArcher({ level }));
        expect(text(el().querySelector('[data-die]'))).withContext(`level ${level}`).toBe(die);
        expect(cards()[1][1]).withContext(`level ${level}`).toBe(damage);
      }
    });

    it('move with Intelligence and the Proficiency Bonus: the DC on every card follows', () => {
      render(makeArcher());
      update(makeArcher({ stats: { STR: 10, DEX: 18, CON: 14, INT: 20, WIS: 12, CHA: 8 } }));
      expect(text(el().querySelector('[data-dc]'))).toBe('16');
      expect(cards().map(card => card[2])).toEqual(['Charisma save, DC 16', null, 'Wisdom save, DC 16']);
      // The sheet's own bonus counts, a DM's line on it included.
      update(makeArcher({ prof: 5 }));
      expect(text(el().querySelector('[data-dc]'))).toBe('16');
      // Without a stored bonus the table for the level is used: +4 at Fighter 9.
      update(makeArcher({ level: 9, prof: undefined }));
      expect(text(el().querySelector('[data-dc]'))).toBe('15');
      // A penalty lowers it; no scores at all is a modifier of 0.
      update(makeArcher({ stats: { STR: 10, DEX: 18, CON: 14, INT: 8, WIS: 12, CHA: 8 } }));
      expect(text(el().querySelector('[data-dc]'))).toBe('10');
      update(makeArcher({ stats: undefined }));
      expect(text(el().querySelector('[data-dc]'))).toBe('11');
    });

    it('follow the stored order, and skip a name that is no option', () => {
      render(makeArcher({ subclassChoices: { skills: [], arcaneShots: ['Shadow Shot', 'Fire Shot', 'Banishing Shot'] } }));
      expect(cards().map(card => card[0])).toEqual(['Shadow Shot', 'Banishing Shot']);
    });
  });

  describe('the uses', () => {
    it('are the arcaneShot class resource: as many as the Intelligence modifier, at least one', () => {
      render(makeArcher({ classResources: { arcaneShot: 1 } }), OWNER);
      const counter = el().querySelector('app-resource-counter')!;
      expect(counter.querySelector('[data-resource]')!.getAttribute('data-resource')).toBe('arcaneShot');
      expect(text(counter.querySelector('.rc-count'))).toBe('2 / 3 left');
      expect(counter.querySelector('.rc-name')).toBeNull();   // the panel title names it
      expect(text(counter.querySelector('.rc-recovery'))).toBe('All back on a Short or Long Rest.');
      expect(el().querySelectorAll('app-resource-counter').length).toBe(1);

      update(makeArcher({ stats: { STR: 10, DEX: 18, CON: 14, INT: 9, WIS: 12, CHA: 8 } }));
      expect(text(el().querySelector('.rc-count'))).toBe('1 / 1 left');
    });

    it('are spent and regained from the panel, saving the same stored amount the feature list writes', () => {
      render(makeArcher({ classResources: { arcaneShot: 1, secondWind: 2 } }), OWNER);
      click(el().querySelector('[data-spend]'));
      expect(emitted.length).toBe(1);
      expect(emitted[0].classResources).toEqual({ secondWind: 2, arcaneShot: 2 });
      expect(emitted[0].subclassChoices).toEqual(makeArcher().subclassChoices);   // the options are not touched
      click(el().querySelector('[data-regain]'));
      expect(emitted[1].classResources).toEqual({ secondWind: 2 });
      expect(pcService.setSubclassChoices).not.toHaveBeenCalled();
    });

    it('can be spent by the DM as well, and by nobody who is only looking', () => {
      render(makeArcher(), DM);
      click(el().querySelector('[data-spend]'));
      expect(emitted[0].classResources).toEqual({ arcaneShot: 1 });

      render(makeArcher());
      expect(el().querySelector('[data-spend]')).toBeNull();
      expect(text(el().querySelector('.rc-count'))).toBe('3 / 3 left');
      fixture.componentInstance.setUsed(2);
      expect(emitted.length).toBe(1);
    });
  });

  describe('a short list (the subclass was set by hand)', () => {
    it('says how many are chosen and lets the owner choose the rest, keeping what is known', () => {
      render(shortArcher(), OWNER);
      expect(text(el().querySelector('.shot-missing'))).toBe('2 of 3 options chosen.');
      expect(el().querySelector('.shot-missing')!.getAttribute('role')).toBe('status');
      expect(text(chooseButton())).toBe('Choose options');

      click(chooseButton());
      expect(chooseButton()).toBeNull();
      expect(el().querySelector('.shot-cards')).toBeNull();
      expect(text(el().querySelector('.shot-chooser-count'))).toBe('2/3');
      expect(boxes().length).toBe(8);
      // A campaign player only adds what is missing: the known options are ticked and fixed.
      expect(box('Banishing Shot').checked && box('Banishing Shot').disabled).toBeTrue();
      expect(box('Shadow Shot').checked && box('Shadow Shot').disabled).toBeTrue();
      expect(saveButton().disabled).toBeTrue();

      tick('Piercing Shot');
      expect(text(el().querySelector('.shot-chooser-count'))).toBe('3/3');
      expect(boxes().filter(b => !b.checked).every(b => b.disabled)).toBeTrue();
      click(saveButton());
      expect(pcService.setSubclassChoices)
        .toHaveBeenCalledOnceWith(7, { arcaneShots: ['Banishing Shot', 'Shadow Shot', 'Piercing Shot'] }, false);
      expect(el().querySelector('.shot-chooser')).toBeNull();
      expect(emitted).toEqual([]);   // never a sheet save
    });

    it('shows the chosen options again once the saved character comes back, and the control is gone', () => {
      render(shortArcher(), OWNER);
      click(chooseButton());
      tick('Piercing Shot');
      click(saveButton());
      update(makeArcher({ subclassChoices: { skills: [], arcaneShots: ['Banishing Shot', 'Shadow Shot', 'Piercing Shot'] } }));
      expect(cards().map(card => card[0])).toEqual(['Banishing Shot', 'Shadow Shot', 'Piercing Shot']);
      expect(el().querySelector('.shot-missing')).toBeNull();
      expect(chooseButton()).toBeNull();   // complete: a campaign player cannot change them
    });

    it('offers every option to an archer with none chosen yet', () => {
      render(makeArcher({ level: 3, subclassChoices: { skills: [] } }), OWNER);
      expect(text(el().querySelector('.shot-missing'))).toBe('0 of 2 options chosen.');
      expect(el().querySelector('.shot-cards')).toBeNull();
      click(chooseButton());
      expect(boxes().every(b => !b.checked && !b.disabled)).toBeTrue();
      tick('Seeking Shot');
      tick('Grasping Shot');
      click(saveButton());
      expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { arcaneShots: ['Grasping Shot', 'Seeking Shot'] }, false);
    });

    it('lets the DM fill it in too', () => {
      render(shortArcher(), DM);
      expect(text(chooseButton())).toBe('Choose options');
      click(chooseButton());
      tick('Seeking Shot');
      click(saveButton());
      expect(pcService.setSubclassChoices)
        .toHaveBeenCalledOnceWith(7, { arcaneShots: ['Banishing Shot', 'Shadow Shot', 'Seeking Shot'] }, true);
    });

    it('shows a viewer who may not edit the count, and no control', () => {
      render(shortArcher());
      expect(text(el().querySelector('.shot-missing'))).toBe('2 of 3 options chosen.');
      expect(chooseButton()).toBeNull();
      fixture.componentInstance.openChooser();
      fixture.detectChanges();
      expect(el().querySelector('.shot-chooser')).toBeNull();
    });
  });

  describe('changing complete options', () => {
    it('is not offered to a player in a campaign', () => {
      render(makeArcher(), OWNER);
      expect(chooseButton()).toBeNull();
      expect(fixture.componentInstance.chooseMode()).toBe('none');
      fixture.componentInstance.openChooser();
      fixture.detectChanges();
      expect(el().querySelector('.shot-chooser')).toBeNull();
    });

    it('is the DM\'s at any time: any known option may go for another', () => {
      render(makeArcher(), DM);
      expect(text(chooseButton())).toBe('Change options');
      click(chooseButton());
      expect(boxes().filter(b => b.checked).length).toBe(3);
      expect(box('Banishing Shot').disabled).toBeFalse();
      expect(box('Seeking Shot').disabled).toBeTrue();   // full until one is unticked

      tick('Banishing Shot');
      tick('Bursting Shot');
      expect(saveButton().disabled).toBeTrue();
      tick('Seeking Shot');
      tick('Piercing Shot');
      expect(saveButton().disabled).toBeFalse();
      click(saveButton());
      expect(pcService.setSubclassChoices)
        .toHaveBeenCalledOnceWith(7, { arcaneShots: ['Shadow Shot', 'Piercing Shot', 'Seeking Shot'] }, true);
    });

    it('is the owner\'s too while the character is in no campaign', () => {
      render(makeArcher({ campaignId: null }), OWNER);
      expect(text(chooseButton())).toBe('Change options');
      expect(fixture.componentInstance.chooseMode()).toBe('any');
      click(chooseButton());
      tick('Shadow Shot');
      tick('Grasping Shot');
      click(saveButton());
      expect(pcService.setSubclassChoices)
        .toHaveBeenCalledOnceWith(7, { arcaneShots: ['Banishing Shot', 'Bursting Shot', 'Grasping Shot'] }, false);
    });

    it('is offered to nobody on a sheet with no character to write to (a follower)', () => {
      render(shortArcher(), { canEdit: true, asDm: true, choosable: false });
      expect(chooseButton()).toBeNull();
      expect(el().querySelector('[data-spend]')).not.toBeNull();   // the uses still work
    });
  });

  describe('the chooser', () => {
    it('closes on Cancel without writing anything, and starts from the known options next time', () => {
      render(makeArcher(), DM);
      click(chooseButton());
      tick('Banishing Shot');
      click(el().querySelector('[data-cancel]'));
      expect(pcService.setSubclassChoices).not.toHaveBeenCalled();
      expect(cards().map(card => card[0])).toEqual(['Banishing Shot', 'Bursting Shot', 'Shadow Shot']);
      click(chooseButton());
      expect(boxes().filter(b => b.checked).length).toBe(3);
    });

    it('holds Save and Cancel while the write is on its way', () => {
      const pending = new Subject<PC>();
      pcService.setSubclassChoices.and.returnValue(pending);
      render(shortArcher(), OWNER);
      click(chooseButton());
      tick('Seeking Shot');
      click(saveButton());
      expect(saveButton().disabled).toBeTrue();
      expect((el().querySelector('[data-cancel]') as HTMLButtonElement).disabled).toBeTrue();
      fixture.componentInstance.saveChooser();   // a second click sends nothing
      expect(pcService.setSubclassChoices).toHaveBeenCalledTimes(1);
      pending.next(makeArcher());
      pending.complete();
      fixture.detectChanges();
      expect(el().querySelector('.shot-chooser')).toBeNull();
    });

    it('says so when the write fails and keeps the picks for another try', () => {
      const failure = { status: 500 };
      pcService.setSubclassChoices.and.returnValue(throwError(() => failure));
      render(shortArcher(), OWNER);
      click(chooseButton());
      tick('Seeking Shot');
      click(saveButton());
      expect(notifications.error).toHaveBeenCalledOnceWith(
        'Could not save the Arcane Shot options. Your picks are still here. Try again.', failure);
      expect(el().querySelector('.shot-chooser')).not.toBeNull();
      expect(box('Seeking Shot').checked).toBeTrue();
      expect(saveButton().disabled).toBeFalse();
    });

    it('never sends an incomplete list', () => {
      render(shortArcher(), OWNER);
      click(chooseButton());
      fixture.componentInstance.saveChooser();
      expect(pcService.setSubclassChoices).not.toHaveBeenCalled();
    });
  });
});
