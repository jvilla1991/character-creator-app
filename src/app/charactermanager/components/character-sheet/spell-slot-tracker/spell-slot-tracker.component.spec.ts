import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAX_SLOT_BARS, SpellSlotTrackerComponent } from './spell-slot-tracker.component';
import { PC } from '../../../models/pc';

type Slots = NonNullable<PC['spellSlots']>;

describe('SpellSlotTrackerComponent', () => {
  let fixture: ComponentFixture<SpellSlotTrackerComponent>;
  let component: SpellSlotTrackerComponent;
  let events: string[];

  const WIZARD: Slots = { 1: { max: 4, used: 2 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 2 } };

  function render(slots: PC['spellSlots'] | null | undefined, inputs: Record<string, unknown> = {}): void {
    fixture.componentRef.setInput('slots', slots);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const columns = (): HTMLButtonElement[] => Array.from(el().querySelectorAll<HTMLButtonElement>('.sst-col'));
  const column = (label: string): HTMLButtonElement =>
    columns().find(c => c.querySelector('.sst-label')!.textContent!.trim() === label)!;
  const text = (css: string): string => el().querySelector(css)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (attr: string): HTMLButtonElement | null => el().querySelector<HTMLButtonElement>(`[${attr}]`);
  const tap = (label: string): void => { column(label).click(); fixture.detectChanges(); };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SpellSlotTrackerComponent] }).compileComponents();
    fixture = TestBed.createComponent(SpellSlotTrackerComponent);
    component = fixture.componentInstance;
    events = [];
    component.spend.subscribe(level => events.push(`spend ${level}`));
    component.restore.subscribe(level => events.push(`restore ${level}`));
    component.restoreAll.subscribe(() => events.push('restore all'));
    component.maximumRequested.subscribe(level => events.push(`maximum ${level}`));
  });

  describe('a character with no slots', () => {
    it('renders nothing at all', () => {
      const none: Array<PC['spellSlots'] | null> = [undefined, null, {}, { 1: { max: 0, used: 0 } }];
      for (const slots of none) {
        render(slots, { canSpend: true, canRestore: true });
        expect(el().querySelector('.sst')).withContext(JSON.stringify(slots)).toBeNull();
        expect(el().textContent!.trim()).withContext(JSON.stringify(slots)).toBe('');
      }
    });
  });

  describe('the strip', () => {
    it('draws one column per spell level, in one row, with a label and a left/max count', () => {
      render(WIZARD);

      expect(text('.sst-title')).toBe('Spell slots');
      expect(columns().map(c => c.querySelector('.sst-label')!.textContent!.trim())).toEqual(['1st', '2nd', '3rd']);
      expect(columns().map(c => c.querySelector('.sst-count')!.textContent!.trim())).toEqual(['2/4', '3/3', '0/2']);
      expect(columns().every(c => c.parentElement === el().querySelector('.sst-strip'))).toBeTrue();
    });

    it('keeps nine levels in the same single row', () => {
      const nine: Slots = {};
      [4, 3, 3, 3, 2, 1, 1, 1, 1].forEach((max, i) => { nine[i + 1] = { max, used: 0 }; });
      render(nine);

      expect(columns().length).toBe(9);
      expect(el().querySelectorAll('.sst-strip').length).toBe(1);
      expect(columns().map(c => c.querySelector('.sst-label')!.textContent!.trim()))
        .toEqual(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']);
    });

    it('shows a Warlock its one slot level', () => {
      render({ 3: { max: 2, used: 1 } });
      expect(columns().map(c => c.getAttribute('aria-label'))).toEqual(['3rd level: 1 of 2 slots left']);
    });

    it('fills a bar per available slot and hollows the spent ones, from the top of the stack', () => {
      render(WIZARD);

      const bars = Array.from(column('1st').querySelectorAll('.sst-bar')).map(b => b.classList.contains('spent'));
      expect(bars).toEqual([true, true, false, false]); // 2 spent on top, 2 available underneath
      expect(column('2nd').querySelectorAll('.sst-bar.spent').length).toBe(0);
      expect(column('3rd').querySelectorAll('.sst-bar:not(.spent)').length).toBe(0);
      expect(column('1st').querySelector('.sst-bars')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('marks a level with nothing left, so its label and count step down the ramp', () => {
      render(WIZARD);
      expect(columns().map(c => c.classList.contains('none-left'))).toEqual([false, false, true]);
    });

    it('draws a very large maximum to scale instead of one bar per slot', () => {
      render({ 1: { max: 40, used: 1 }, 2: { max: 40, used: 0 }, 3: { max: 40, used: 40 }, 4: { max: 40, used: 39 } });

      const spentBars = (label: string) => column(label).querySelectorAll('.sst-bar.spent').length;
      expect(column('1st').querySelectorAll('.sst-bar').length).toBe(MAX_SLOT_BARS);
      expect(spentBars('1st')).toBe(1);                  // something is spent: never drawn as full
      expect(spentBars('2nd')).toBe(0);
      expect(spentBars('3rd')).toBe(MAX_SLOT_BARS);
      expect(spentBars('4th')).toBe(MAX_SLOT_BARS - 1);  // something is left: never drawn as empty
      expect(text('.sst-col:first-child .sst-count')).toBe('39/40');
    });

    it('makes each column a real button that says its state', () => {
      render(WIZARD);

      expect(columns().every(c => c.tagName === 'BUTTON' && c.getAttribute('type') === 'button')).toBeTrue();
      expect(columns().map(c => c.getAttribute('aria-label'))).toEqual([
        '1st level: 2 of 4 slots left', '2nd level: 3 of 3 slots left', '3rd level: 0 of 2 slots left',
      ]);
      expect(columns().map(c => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
    });
  });

  describe('the detail row', () => {
    it('is closed until a column is tapped, inside a polite live region that is always there', () => {
      render(WIZARD);

      const live = el().querySelector('[aria-live="polite"]')!;
      expect(live).not.toBeNull();
      expect(live.querySelector('.sst-detail')).toBeNull();

      tap('1st');
      expect(live.querySelector('.sst-detail')).not.toBeNull();
      expect(text('.sst-detail-title')).toBe('1st-level slots: 2 of 4 left');
    });

    it('selects the tapped column, and a second tap closes it again', () => {
      render(WIZARD);

      tap('2nd');
      expect(column('2nd').getAttribute('aria-pressed')).toBe('true');
      expect(column('2nd').classList.contains('selected')).toBeTrue();
      expect(column('1st').getAttribute('aria-pressed')).toBe('false');

      tap('3rd');
      expect(column('2nd').classList.contains('selected')).toBeFalse();
      expect(text('.sst-detail-title')).toBe('3rd-level slots: none left');

      tap('3rd');
      expect(el().querySelector('.sst-detail')).toBeNull();
      expect(column('3rd').getAttribute('aria-pressed')).toBe('false');
    });

    it('follows the slots it is given while keeping the selected level', () => {
      render(WIZARD);
      tap('1st');

      render({ ...WIZARD, 1: { max: 4, used: 3 } }); // a cast, a rest, the DM, the session poll
      expect(column('1st').getAttribute('aria-pressed')).toBe('true');
      expect(text('.sst-detail-title')).toBe('1st-level slots: 1 of 4 left');
      expect(column('1st').querySelector('.sst-count')!.textContent!.trim()).toBe('1/4');
    });

    it('closes when the selected level no longer exists', () => {
      render(WIZARD);
      tap('3rd');

      render({ 1: { max: 4, used: 2 }, 2: { max: 3, used: 0 } });
      expect(el().querySelector('.sst-detail')).toBeNull();
      expect(columns().every(c => c.getAttribute('aria-pressed') === 'false')).toBeTrue();
    });

    it('starts closed again for a different character', () => {
      render(WIZARD, { characterId: 1 });
      tap('1st');

      render(WIZARD, { characterId: 2 });
      expect(el().querySelector('.sst-detail')).toBeNull();
    });

    it('offers no actions to a viewer who may do nothing', () => {
      render(WIZARD);
      tap('1st');

      expect(el().querySelector('.sst-actions')).toBeNull();
      expect(button('data-restore-all')).toBeNull();
    });
  });

  describe('spending and restoring', () => {
    it('lets a viewer who may spend ask for a slot of the selected level', () => {
      render(WIZARD, { canSpend: true });
      tap('1st');

      expect(button('data-spend')!.textContent!.trim()).toBe('Spend a slot');
      expect(button('data-restore')).toBeNull();
      button('data-spend')!.click();
      expect(events).toEqual(['spend 1']);
    });

    it('disables Spend when the level has nothing left', () => {
      render(WIZARD, { canSpend: true });
      tap('3rd');

      expect(button('data-spend')!.disabled).toBeTrue();
      component.onSpend();
      expect(events).toEqual([]);
    });

    it('lets a viewer who may restore give one slot back, or all of them', () => {
      render(WIZARD, { canSpend: true, canRestore: true });
      tap('1st');

      expect(button('data-restore')!.textContent!.trim()).toBe('Restore a slot');
      button('data-restore')!.click();
      expect(button('data-restore-all')!.textContent!.trim()).toBe('Restore all');
      button('data-restore-all')!.click();
      expect(events).toEqual(['restore 1', 'restore all']);
    });

    it('disables Restore where nothing is spent', () => {
      render(WIZARD, { canRestore: true });
      tap('2nd');
      expect(button('data-restore')!.disabled).toBeTrue();
      expect(button('data-restore-all')!.disabled).toBeFalse(); // other levels have spent slots

      render({ 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 } }, { canRestore: true });
      expect(button('data-restore-all')!.disabled).toBeTrue();
      component.onRestore();
      component.onRestoreAll();
      expect(events).toEqual([]);
    });

    it('never emits for a viewer who may not, even if asked directly', () => {
      render(WIZARD);
      tap('1st');

      component.onSpend();
      component.onRestore();
      component.onRestoreAll();
      expect(events).toEqual([]);
    });
  });

  describe('what just happened', () => {
    it('says a notice under the title and selects the level it is about', () => {
      render(WIZARD);
      expect(el().querySelector('.sst-note')).toBeNull();

      render({ ...WIZARD, 2: { max: 3, used: 1 } },
        { notice: { level: 2, text: 'Misty Step cast with a 2nd-level slot.' } });

      expect(column('2nd').getAttribute('aria-pressed')).toBe('true');
      expect(text('.sst-detail-title')).toBe('2nd-level slots: 2 of 3 left');
      expect(text('.sst-note')).toBe('Misty Step cast with a 2nd-level slot.');
      expect(el().querySelector('[aria-live="polite"] .sst-note')).not.toBeNull();
    });

    it('moves the selection to the level that paid, wherever it was', () => {
      render(WIZARD);
      tap('1st');

      render(WIZARD, { notice: { level: 3, text: 'One 3rd-level slot restored.' } });
      expect(column('1st').getAttribute('aria-pressed')).toBe('false');
      expect(column('3rd').getAttribute('aria-pressed')).toBe('true');
      expect(text('.sst-note')).toBe('One 3rd-level slot restored.');
    });

    it('keeps the selection for a notice about no level in particular', () => {
      render(WIZARD);
      tap('1st');

      render({ 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
        { notice: { level: null, text: 'All slots restored.' } });
      expect(column('1st').getAttribute('aria-pressed')).toBe('true');
      expect(text('.sst-detail-title')).toBe('1st-level slots: 4 of 4 left');
      expect(text('.sst-note')).toBe('All slots restored.');
    });

    it('says a notice on its own line when no level is open', () => {
      render(WIZARD);

      render(WIZARD, { notice: { level: null, text: 'All slots restored.' } });
      expect(el().querySelector('.sst-detail-title')).toBeNull();
      expect(text('[aria-live="polite"] .sst-note')).toBe('All slots restored.');
    });

    it('drops the line when the viewer picks a column', () => {
      render(WIZARD);
      render(WIZARD, { notice: { level: 2, text: 'One 2nd-level slot spent by hand.' } });

      tap('1st');
      expect(el().querySelector('.sst-note')).toBeNull();
      expect(text('.sst-detail-title')).toBe('1st-level slots: 2 of 4 left');
    });

    it('keeps the line while the slots it is given move on', () => {
      render(WIZARD);
      render(WIZARD, { notice: { level: 1, text: 'One 1st-level slot spent by hand.' } });

      render({ ...WIZARD, 1: { max: 4, used: 3 } }); // the session poll catches up
      expect(text('.sst-note')).toBe('One 1st-level slot spent by hand.');
      expect(text('.sst-detail-title')).toBe('1st-level slots: 1 of 4 left');
    });

    it('never repeats a notice that was already there when the strip appeared', () => {
      // Leaving the Spells tab and coming back builds a new strip; the last notice is old news.
      render(WIZARD, { notice: { level: 2, text: 'One 2nd-level slot spent by hand.' } });

      expect(el().querySelector('.sst-note')).toBeNull();
      expect(el().querySelector('.sst-detail')).toBeNull();
    });

    it('drops the line for a different character', () => {
      render(WIZARD, { characterId: 1 });
      render(WIZARD, { notice: { level: 1, text: 'One 1st-level slot spent by hand.' } });
      expect(text('.sst-note')).toBe('One 1st-level slot spent by hand.');

      render(WIZARD, { characterId: 2 });
      expect(el().querySelector('.sst-note')).toBeNull();
    });
  });

  describe('while a change is on its way to the server', () => {
    it('holds further spends and restores without restyling the buttons', () => {
      render(WIZARD, { canSpend: true, canRestore: true, busy: true });
      tap('1st');

      expect(button('data-spend')!.disabled).toBeFalse();
      button('data-spend')!.click();
      button('data-restore')!.click();
      button('data-restore-all')!.click();
      expect(events).toEqual([]);
      expect(el().querySelector('[aria-live="polite"]')!.getAttribute('aria-busy')).toBe('true');

      render(WIZARD, { busy: false });
      button('data-spend')!.click();
      expect(events).toEqual(['spend 1']);
    });
  });

  describe('the slot maximum', () => {
    it('is not offered unless the host asks for it', () => {
      render(WIZARD, { canSpend: true });
      tap('1st');
      expect(button('data-maximum')).toBeNull();
    });

    it('asks for the selected level\'s maximum, also for a viewer who may do nothing else', () => {
      render(WIZARD, { showMaximum: true });
      tap('3rd');

      const maximum = button('data-maximum')!;
      expect(maximum.textContent!.trim()).toBe('Slot maximum');
      expect(maximum.getAttribute('aria-label')).toBe('Slot maximum for 3rd level');
      expect(button('data-spend')).toBeNull();
      maximum.click();
      expect(events).toEqual(['maximum 3']);
    });

    it('keeps a level the DM\'s lines took to nothing on the strip, so the lines can be undone', () => {
      render({ 1: { max: 4, used: 0 } }, { canSpend: true, canRestore: true, showMaximum: true, extraLevels: [6] });

      expect(columns().map(c => c.getAttribute('aria-label')))
        .toEqual(['1st level: 4 of 4 slots left', '6th level: 0 of 0 slots left']);
      expect(column('6th').querySelectorAll('.sst-bar').length).toBe(0);
      expect(column('6th').classList.contains('none-left')).toBeTrue();

      tap('6th');
      expect(text('.sst-detail-title')).toBe('6th-level slots: none left');
      expect(button('data-spend')!.disabled).toBeTrue();
      expect(button('data-restore')!.disabled).toBeTrue();
      button('data-maximum')!.click();
      expect(events).toEqual(['maximum 6']);
    });

    it('shows such a level alone when it is the only one', () => {
      render({}, { showMaximum: true, extraLevels: [1] });
      expect(columns().length).toBe(1);
    });

    it('does not double a level that has slots after all', () => {
      render(WIZARD, { extraLevels: [1, 2] });
      expect(columns().length).toBe(3);
    });
  });

  it('labels the block with its own heading', () => {
    render(WIZARD);
    const section = fixture.debugElement.query(By.css('section.sst')).nativeElement as HTMLElement;
    const heading = el().querySelector('.sst-title')!;
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.id).toBeTruthy();
  });
});
