import { signal, Signal, WritableSignal } from '@angular/core';
import { DiceFabComponent } from './dice-fab.component';
import { DiceRollerService } from '../../services/dice-roller.service';

// Class-only tests (no TestBed): the component is a trigger, so everything
// worth testing is the shortcut's guard conditions.
describe('DiceFabComponent', () => {
  let isOpen: WritableSignal<boolean>;
  let dice: { isOpen: Signal<boolean>; open: jasmine.Spy; close: jasmine.Spy };
  let component: DiceFabComponent;

  /** A keydown with only the fields the handler reads. */
  const keydown = (
    key: string,
    over: Partial<KeyboardEvent> = {},
    target: unknown = null,
  ): KeyboardEvent & { preventDefault: jasmine.Spy } =>
    ({
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target,
      preventDefault: jasmine.createSpy('preventDefault'),
      ...over,
    } as unknown as KeyboardEvent & { preventDefault: jasmine.Spy });

  const element = (tag: string): HTMLElement => document.createElement(tag);

  beforeEach(() => {
    isOpen = signal(false);
    dice = {
      isOpen: isOpen.asReadonly(),
      open: jasmine.createSpy('open'),
      close: jasmine.createSpy('close'),
    };
    component = new DiceFabComponent(dice as unknown as DiceRollerService);
  });

  afterEach(() => {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  });

  it('opens the roller when clicked', () => {
    component.open();

    expect(dice.open).toHaveBeenCalledTimes(1);
  });

  describe('the "r" shortcut', () => {
    it('opens the roller, in either case', () => {
      const lower = keydown('r');
      component.onKeydown(lower);
      component.onKeydown(keydown('R'));

      expect(dice.open).toHaveBeenCalledTimes(2);
      expect(lower.preventDefault).toHaveBeenCalled();
    });

    it('ignores other keys', () => {
      component.onKeydown(keydown('d'));
      component.onKeydown(keydown('Enter'));

      expect(dice.open).not.toHaveBeenCalled();
    });

    it('leaves Ctrl/Cmd+R to the browser (page reload)', () => {
      const ctrl = keydown('r', { ctrlKey: true });
      component.onKeydown(ctrl);
      component.onKeydown(keydown('r', { metaKey: true }));
      component.onKeydown(keydown('r', { altKey: true }));

      expect(dice.open).not.toHaveBeenCalled();
      expect(ctrl.preventDefault).not.toHaveBeenCalled();
    });

    it('does not fire while the player is typing', () => {
      component.onKeydown(keydown('r', {}, element('input')));
      component.onKeydown(keydown('r', {}, element('textarea')));
      component.onKeydown(keydown('r', {}, element('select')));

      const editable = element('div');
      editable.contentEditable = 'true';
      spyOnProperty(editable, 'isContentEditable').and.returnValue(true);
      component.onKeydown(keydown('r', {}, editable));

      expect(dice.open).not.toHaveBeenCalled();
    });

    it('still fires from a plain element (the dice button itself, say)', () => {
      component.onKeydown(keydown('r', {}, element('button')));

      expect(dice.open).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the roller is already open', () => {
      isOpen.set(true);

      component.onKeydown(keydown('r'));

      expect(dice.open).not.toHaveBeenCalled();
    });

    it('does not stack on top of another open overlay', () => {
      // Every overlay in the app renders one of these backdrops — a level-up
      // modal, say, or the delete confirmation.
      document.body.appendChild(element('div')).classList.add('modal-backdrop');

      component.onKeydown(keydown('r'));

      expect(dice.open).not.toHaveBeenCalled();
    });
  });
});
