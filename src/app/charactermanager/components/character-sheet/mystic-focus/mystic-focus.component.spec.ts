import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MysticFocusComponent } from './mystic-focus.component';
import { MysticFocusRequest } from '../../../models/mystic-focus';
import { PC } from '../../../models/pc';

describe('MysticFocusComponent', () => {
  const MYSTIC_ARTS = 'Warrior of the Mystic Arts';
  let fixture: ComponentFixture<MysticFocusComponent>;
  let el: HTMLElement;
  let emitted: MysticFocusRequest[];

  /** A Monk 8 of the Mystic Arts: slots 4 / 2 with one of each spent, 5 of 8 Focus Points expended. */
  const monk = (over: Partial<PC> = {}): PC => ({
    id: 1, name: 'Shen', clazz: 'Monk', subclass: MYSTIC_ARTS, level: 8, playerName: 'Sam',
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 1 } },
    classResources: { focusPoints: 5 },
    ...over,
  });

  function render(pc: PC, busy = false): void {
    fixture = TestBed.createComponent(MysticFocusComponent);
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('busy', busy);
    emitted = [];
    fixture.componentInstance.convert.subscribe(request => emitted.push(request));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const buttons = (selector: string): HTMLButtonElement[] => Array.from(el.querySelectorAll<HTMLButtonElement>(selector));
  const slotToFocus = () => buttons('[data-slot-to-focus]');
  const focusToSlot = () => buttons('[data-focus-to-slot]');
  const text = (node: Element | null): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const press = (button: HTMLButtonElement): void => { button.click(); fixture.detectChanges(); };

  it('renders nothing for a character without the feature', () => {
    for (const pc of [
      monk({ level: 5 }), monk({ subclass: 'Warrior of the Open Hand' }), monk({ subclass: undefined }),
      monk({ clazz: 'Wizard' }), monk({ clazz: 'Fighter', subclass: 'Eldritch Knight' }),
    ]) {
      render(pc);
      expect(el.querySelector('.mf')).withContext(`${pc.clazz} ${pc.subclass} ${pc.level}`).toBeNull();
      expect(text(el)).toBe('');
    }
  });

  it('shows the Focus Points left and one button each way per spell level', () => {
    render(monk());

    expect(text(el.querySelector('.mf-title'))).toBe('Mystic Focus');
    expect(text(el.querySelector('.mf-points'))).toBe('3 / 8 Focus Points left');
    // The spell level, then what the trade gives (+) or costs (−) in Focus Points.
    const parts = (b: HTMLButtonElement) => [text(b.querySelector('.mf-btn-level')), text(b.querySelector('.mf-btn-amount'))];
    expect(slotToFocus().map(parts)).toEqual([['1st', '+1'], ['2nd', '+2']]);
    expect(focusToSlot().map(parts)).toEqual([['1st', '−2'], ['2nd', '−3']]);
    expect(slotToFocus().map(b => b.getAttribute('aria-label'))).toEqual([
      'Spend a 1st-level slot for 1 Focus Point', 'Spend a 2nd-level slot for 2 Focus Points',
    ]);
    expect(focusToSlot().map(b => b.getAttribute('aria-label'))).toEqual([
      'Spend 2 Focus Points for a 1st-level slot', 'Spend 3 Focus Points for a 2nd-level slot',
    ]);
    expect([...slotToFocus(), ...focusToSlot()].every(b => !b.disabled)).toBeTrue();
    expect(el.querySelector('.mf-confirm')).toBeNull();
  });

  it('labels the two rows as groups', () => {
    render(monk());
    expect(Array.from(el.querySelectorAll('.mf-row')).map(r => [r.getAttribute('role'), r.getAttribute('aria-label')]))
      .toEqual([['group', 'Spell slot to Focus Points'], ['group', 'Focus Points to spell slot']]);
    expect(Array.from(el.querySelectorAll('.mf-label')).map(text)).toEqual(['Slot to Focus Points', 'Focus Points to slot']);
    const section = el.querySelector('section.mf')!;
    expect(el.querySelector(`#${section.getAttribute('aria-labelledby')}`)).toBe(el.querySelector('.mf-title'));
  });

  it('keeps an action that is not possible, disabled, with the reason as its tooltip', () => {
    // Rested and full of Focus Points: nothing to trade either way.
    render(monk({ spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } }, classResources: {} }));

    expect(slotToFocus().length).toBe(2);
    expect(focusToSlot().length).toBe(2);
    expect([...slotToFocus(), ...focusToSlot()].every(b => b.disabled)).toBeTrue();
    expect(slotToFocus().map(b => b.getAttribute('title')))
      .toEqual(['No expended Focus Points to regain', 'No expended Focus Points to regain']);
    expect(focusToSlot().map(b => b.getAttribute('title')))
      .toEqual(['No spent level 1 slot to restore', 'No spent level 2 slot to restore']);
    // A disabled button has nothing to expand.
    expect(slotToFocus()[0].hasAttribute('aria-expanded')).toBeFalse();
  });

  it('asks before converting: nothing is emitted until Convert is pressed', () => {
    render(monk());

    press(slotToFocus()[1]);

    expect(emitted).toEqual([]);
    expect(text(el.querySelector('.mf-confirm-text'))).toBe(
      'Spend one 2nd-level spell slot to regain 2 Focus Points. The rule allows this at any time, with no action.');
    expect(slotToFocus()[1].getAttribute('aria-expanded')).toBe('true');
    expect(slotToFocus()[1].classList).toContain('on');
    expect(slotToFocus()[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons('.mf-confirm button').map(text)).toEqual(['Convert', 'Cancel']);

    press(el.querySelector<HTMLButtonElement>('[data-confirm]')!);

    expect(emitted).toEqual([{ action: 'SLOT_TO_FOCUS', slotLevel: 2 }]);
    expect(el.querySelector('.mf-confirm')).toBeNull();
  });

  it('says when the rule allows turning Focus Points into a slot, and what it costs', () => {
    render(monk());

    press(focusToSlot()[0]);

    expect(text(el.querySelector('.mf-confirm-text'))).toBe(
      'Spend 2 Focus Points to recover one 1st-level spell slot. '
      + 'The rule allows this when you finish a Short Rest or use Uncanny Metabolism.');
    press(el.querySelector<HTMLButtonElement>('[data-confirm]')!);
    expect(emitted).toEqual([{ action: 'FOCUS_TO_SLOT', slotLevel: 1 }]);
  });

  it('Cancel, or a second press on the same button, takes the question back', () => {
    render(monk());

    press(focusToSlot()[1]);
    press(el.querySelector<HTMLButtonElement>('[data-cancel]')!);
    expect(el.querySelector('.mf-confirm')).toBeNull();

    press(focusToSlot()[1]);
    expect(el.querySelector('.mf-confirm')).not.toBeNull();
    press(focusToSlot()[1]);
    expect(el.querySelector('.mf-confirm')).toBeNull();
    expect(emitted).toEqual([]);
  });

  it('another button replaces the question that was open', () => {
    render(monk());

    press(slotToFocus()[0]);
    press(focusToSlot()[1]);

    expect(el.querySelectorAll('.mf-confirm').length).toBe(1);
    expect(text(el.querySelector('.mf-confirm-text'))).toContain('Spend 3 Focus Points to recover one 2nd-level spell slot.');
  });

  it('drops an open question once the character no longer allows it', () => {
    render(monk());
    press(slotToFocus()[0]);
    expect(el.querySelector('.mf-confirm')).not.toBeNull();

    // The session poll brought a rested character: no Focus Point is expended any more.
    fixture.componentRef.setInput('pc', monk({ classResources: {} }));
    fixture.detectChanges();

    expect(el.querySelector('.mf-confirm')).toBeNull();
    fixture.componentInstance.confirm();
    expect(emitted).toEqual([]);
  });

  it('does not carry an open question over to another character', () => {
    render(monk());
    press(slotToFocus()[0]);

    fixture.componentRef.setInput('pc', monk({ id: 2 }));
    fixture.detectChanges();

    expect(el.querySelector('.mf-confirm')).toBeNull();
  });

  it('waits while a conversion is on its way', () => {
    render(monk(), true);

    expect([...slotToFocus(), ...focusToSlot()].every(b => b.disabled)).toBeTrue();
    fixture.componentInstance.ask(fixture.componentInstance.view()!.slotToFocus[0]);
    fixture.detectChanges();
    expect(el.querySelector('.mf-confirm')).toBeNull();
    expect(el.querySelector('[aria-live="polite"]')!.getAttribute('aria-busy')).toBe('true');
  });

  it('keeps an open question when the same character arrives again as a new object', () => {
    // The session hands the sheet a new but equal character on every poll.
    render(monk());
    press(slotToFocus()[0]);

    fixture.componentRef.setInput('pc', monk());
    fixture.detectChanges();

    expect(el.querySelector('.mf-confirm')).not.toBeNull();
    press(el.querySelector<HTMLButtonElement>('[data-confirm]')!);
    expect(emitted).toEqual([{ action: 'SLOT_TO_FOCUS', slotLevel: 1 }]);
  });
});
