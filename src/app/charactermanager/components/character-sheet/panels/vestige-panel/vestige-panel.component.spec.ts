import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { VestigePanelComponent } from './vestige-panel.component';
import { PCService } from '../../../../services/pc.service';
import { NotificationService } from '../../../../services/notification.service';
import { PC } from '../../../../models/pc';

describe('VestigePanelComponent', () => {
  let fixture: ComponentFixture<VestigePanelComponent>;
  let pcService: jasmine.SpyObj<PCService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  const patron = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: 5, playerName: 'Sam',
    subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' },
    ...over,
  });

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['setSubclassChoices']);
    pcService.setSubclassChoices.and.returnValue(of(patron()));
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['error', 'notify']);
    TestBed.configureTestingModule({
      providers: [{ provide: PCService, useValue: pcService }, { provide: NotificationService, useValue: notifications }],
    });
  });

  function render(pc: PC, who: { ownSheet?: boolean; asDm?: boolean } = { ownSheet: true }): HTMLElement {
    fixture = TestBed.createComponent(VestigePanelComponent);
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('ownSheet', !!who.ownSheet);
    fixture.componentRef.setInput('asDm', !!who.asDm);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element) => node.textContent!.replace(/\s+/g, ' ').trim();
  const typeButtons = () => Array.from(el().querySelectorAll('.vestige-type')) as HTMLButtonElement[];
  const typeButton = (name: string) => typeButtons().find(b => text(b) === name)!;
  const values = () => Array.from(el().querySelectorAll('.vestige-value')).map(text);
  const select = () => el().querySelector('select') as HTMLSelectElement | null;
  const setButton = () => el().querySelector('.vestige-domain-set') as HTMLButtonElement | null;
  const pickDomain = (index: number) => {
    select()!.selectedIndex = index;
    select()!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  describe('the type', () => {
    it('is three buttons for the owner, the current one pressed', () => {
      render(patron());
      expect(typeButtons().map(text)).toEqual(['Celestial', 'Fiend', 'Undead']);
      expect(typeButtons().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
      expect(typeButton('Fiend').classList).toContain('primary');
      expect(el().querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Vestige type');
    });

    it('is changed with one press, by the owner as the player', () => {
      render(patron());
      typeButton('Undead').click();
      expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { vestigeType: 'Undead' }, false);
    });

    it('is changed by the DM as the DM', () => {
      render(patron(), { asDm: true });
      typeButton('Celestial').click();
      expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { vestigeType: 'Celestial' }, true);
    });

    it('is not saved again when the current one is pressed', () => {
      render(patron());
      typeButton('Fiend').click();
      expect(pcService.setSubclassChoices).not.toHaveBeenCalled();
    });

    it('is offered with none pressed to a patron whose subclass was set by hand', () => {
      render(patron({ subclassChoices: null }));
      expect(typeButtons().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
      typeButton('Celestial').click();
      expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { vestigeType: 'Celestial' }, false);
    });

    it('waits for the server: the buttons are disabled while a change is on its way', () => {
      const pending = new Subject<PC>();
      pcService.setSubclassChoices.and.returnValue(pending);
      render(patron());

      typeButton('Undead').click();
      fixture.detectChanges();
      expect(typeButtons().every(b => b.disabled)).toBeTrue();
      typeButton('Celestial').click();
      expect(pcService.setSubclassChoices).toHaveBeenCalledTimes(1);

      pending.next(patron());
      pending.complete();
      fixture.detectChanges();
      expect(typeButtons().some(b => b.disabled)).toBeFalse();
    });

    it('says so when the change fails, and can be tried again', () => {
      const refused = { status: 400, error: { message: 'nope' } };
      pcService.setSubclassChoices.and.returnValue(throwError(() => refused));
      render(patron());

      typeButton('Undead').click();
      fixture.detectChanges();

      expect(notifications.error).toHaveBeenCalledOnceWith('Could not change the Vestige type. Try again.', refused);
      expect(typeButtons().some(b => b.disabled)).toBeFalse();
    });

    it('follows the character once the server answered', () => {
      render(patron());
      fixture.componentRef.setInput('pc', patron({ subclassChoices: { vestigeType: 'Undead', vestigeDomain: 'War' } }));
      fixture.detectChanges();
      expect(typeButtons().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    });
  });

  describe('the domain', () => {
    it('is plain text once chosen, for the owner and the DM alike', () => {
      render(patron());
      expect(select()).toBeNull();
      expect(values()).toEqual(['War']);
      render(patron(), { asDm: true });
      expect(select()).toBeNull();
      expect(values()).toEqual(['War']);
    });

    it('is a labelled select while it is unset, saved with its own button', () => {
      render(patron({ subclassChoices: { vestigeType: 'Fiend' } }));
      expect(Array.from(select()!.options).map(o => text(o)))
        .toEqual(['Choose a domain…', 'Life', 'Light', 'Trickery', 'War']);
      expect(el().querySelector(`label[for="${select()!.id}"]`)!.textContent!.trim()).toBe('Vestige Spells domain');
      expect(setButton()!.disabled).toBeTrue();

      pickDomain(3);
      expect(setButton()!.disabled).toBeFalse();
      expect(pcService.setSubclassChoices).not.toHaveBeenCalled();
      setButton()!.click();
      expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { vestigeDomain: 'Trickery' }, false);
    });

    it('says so when it could not be set', () => {
      const refused = { status: 403, error: { message: 'no' } };
      pcService.setSubclassChoices.and.returnValue(throwError(() => refused));
      render(patron({ subclassChoices: null }), { asDm: true });
      pickDomain(1);
      setButton()!.click();
      expect(pcService.setSubclassChoices).toHaveBeenCalledOnceWith(7, { vestigeDomain: 'Life' }, true);
      expect(notifications.error)
        .toHaveBeenCalledOnceWith('Could not set the Vestige Spells domain. Try again.', refused);
    });
  });

  describe('for a viewer who is neither the owner nor the DM', () => {
    it('shows both choices as text, with no control', () => {
      render(patron(), {});
      expect(typeButtons()).toEqual([]);
      expect(select()).toBeNull();
      expect(values()).toEqual(['Fiend', 'War']);

      render(patron({ subclassChoices: null }), {});
      expect(values()).toEqual(['Not chosen', 'Not chosen']);
      expect(el().querySelector('button')).toBeNull();
    });
  });

  it('renders nothing below Warlock 3, for another patron or for another class', () => {
    for (const pc of [patron({ level: 2 }), patron({ subclass: 'Fiend Patron' }), patron({ subclass: undefined }),
      patron({ clazz: 'Fighter', subclass: 'Champion' })]) {
      expect(render(pc).children.length).withContext(`${pc.clazz} ${pc.subclass} ${pc.level}`).toBe(0);
    }
  });
});
