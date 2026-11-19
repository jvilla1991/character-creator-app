import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LongRestPanelComponent } from './long-rest-panel.component';
import { LongRestView, ParticipantView } from '../../../models/session';

describe('LongRestPanelComponent', () => {
  let fixture: ComponentFixture<LongRestPanelComponent>;
  let component: LongRestPanelComponent;

  const phase = (over: Partial<LongRestView> = {}): LongRestView => ({
    advanceClock: true,
    undisturbed: true,
    readyCount: 1,
    ableCount: 2,
    readiness: [
      { participantId: 5, pcId: 7, displayName: 'Bex', ready: true, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null },
      { participantId: 6, pcId: 8, displayName: 'Mira', ready: false, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null },
      { participantId: 9, pcId: 9, displayName: 'Thorne', ready: false, cannotRest: true, clazz: null, subclass: null, specialization: null, level: null },
    ],
    myChoices: null,
    ...over,
  });

  const seat = (participantId: number, clazz: string, hpCurrent: number, hpMax: number): ParticipantView =>
    ({ participantId, clazz, level: 5, hpCurrent, hpMax } as ParticipantView);

  const party = [seat(5, 'Fighter', 18, 44), seat(6, 'Cleric', 38, 38), seat(9, 'Paladin', 0, 40)];

  function render(view: LongRestView = phase(), survival = false): void {
    fixture.componentRef.setInput('longRest', view);
    fixture.componentRef.setInput('participants', party);
    fixture.componentRef.setInput('survivalConditions', survival);
    fixture.detectChanges();
  }

  const q = (css: string) => fixture.debugElement.query(By.css(css));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LongRestPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(LongRestPanelComponent);
    component = fixture.componentInstance;
  });

  it('lists every seated hero with a status, and the ready tally', () => {
    render();

    expect(q('.lr-count').nativeElement.textContent).toContain('1 of 2 ready');
    const rows = component.rows();
    expect(rows.map(r => r.statusLabel)).toEqual(['✓ Ready', 'Getting ready', 'At 0 Hit Points']);
    expect(rows.map(r => r.status)).toEqual(['ready', 'waiting', 'down']);

    const pills = fixture.debugElement.queryAll(By.css('.lr-status'));
    expect(pills.length).toBe(3);
    expect(pills[0].nativeElement.classList).toContain('ready');
    expect(pills[2].nativeElement.classList).toContain('down');
    expect(pills[2].nativeElement.textContent).toContain('At 0 Hit Points');
  });

  it('describes each hero by class, level and the Hit Points the rest gives back', () => {
    render();

    const rows = component.rows();
    expect(rows[0].detail).toBe('Fighter 5 · +26 HP');
    expect(rows[1].detail).toBe('Cleric 5');          // already full — no gain shown
    expect(rows[2].detail).toBe('Paladin 5');         // at 0 Hit Points — gains nothing
  });

  it('names the hero class from the readiness row by its short name (Death Knight, not Paladin)', () => {
    const view = phase();
    view.readiness[0] = {
      ...view.readiness[0], clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost', level: 6,
    };
    render(view);

    expect(component.rows()[0].detail).toBe('Death Knight 6 · +26 HP');
    expect(component.rows()[1].detail).toBe('Cleric 5'); // no details sent: the seat's own class
  });

  it('a hero missing from the participant list still gets a row', () => {
    fixture.componentRef.setInput('longRest', phase());
    fixture.detectChanges();

    expect(component.rows().length).toBe(3);
    expect(component.rows()[0].detail).toBe('');
  });

  it('the clock checkbox follows the snapshot and emits only that option', () => {
    const emitted: unknown[] = [];
    component.optionsChange.subscribe(o => emitted.push(o));
    render();

    const box: HTMLInputElement = q('[data-advance-clock]').nativeElement;
    expect(box.checked).toBeTrue();

    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([{ advanceClock: false }]);

    render(phase({ advanceClock: false }));
    expect((q('[data-advance-clock]').nativeElement as HTMLInputElement).checked).toBeFalse();
  });

  it('offers undisturbed / disturbed only in a survival campaign', () => {
    render(phase(), false);
    expect(q('[data-undisturbed]')).toBeNull();

    render(phase(), true);
    expect(q('[data-undisturbed]').attributes['aria-pressed']).toBe('true');
    expect(q('[data-disturbed]').attributes['aria-pressed']).toBe('false');
  });

  it('choosing the other disturbance emits it; choosing the current one emits nothing', () => {
    const emitted: unknown[] = [];
    component.optionsChange.subscribe(o => emitted.push(o));
    render(phase(), true);

    q('[data-undisturbed]').nativeElement.click();
    expect(emitted).toEqual([]);

    q('[data-disturbed]').nativeElement.click();
    expect(emitted).toEqual([{ undisturbed: false }]);
  });

  it('warns that heroes who are not ready keep their choices, until everyone is ready', () => {
    render();
    expect(q('[data-finish-note]').nativeElement.textContent)
      .toContain('Heroes who are not ready keep their current spells and rune weapon if you finish now.');

    render(phase({ readyCount: 2 }));
    expect(q('[data-finish-note]')).toBeNull();
  });

  it('Finish the Rest and Interrupt emit their own events', () => {
    let finished = 0;
    let interrupted = 0;
    component.finish.subscribe(() => finished++);
    component.interrupt.subscribe(() => interrupted++);
    render();

    q('[data-finish]').nativeElement.click();
    q('[data-interrupt]').nativeElement.click();

    expect(finished).toBe(1);
    expect(interrupted).toBe(1);
  });
});
