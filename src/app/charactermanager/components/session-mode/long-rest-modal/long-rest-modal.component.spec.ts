import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LongRestModalComponent } from './long-rest-modal.component';
import { LongRestView } from '../../../models/session';
import { PC } from '../../../models/pc';

describe('LongRestModalComponent', () => {
  let fixture: ComponentFixture<LongRestModalComponent>;
  let component: LongRestModalComponent;

  const pc = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Bex', clazz: 'Fighter', level: 5,
    hp: { cur: 18, max: 44, temp: 5 },
    hitDiceUsed: 4,
    exhaustion: 2,
    ...over,
  } as PC);

  const phase = (over: Partial<LongRestView> = {}): LongRestView => ({
    advanceClock: true,
    undisturbed: true,
    readyCount: 1,
    ableCount: 3,
    readiness: [
      { participantId: 5, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null },
      { participantId: 6, pcId: 8, displayName: 'Mira', ready: true, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null },
      { participantId: 9, pcId: 9, displayName: 'Oswin', ready: false, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null },
    ],
    myChoices: null,
    ...over,
  });

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  const row = (name: string): string =>
    fixture.debugElement.query(By.css(`[data-row="${name}"]`))?.nativeElement.textContent.replace(/\s+/g, ' ') ?? '';

  function render(hero: PC, view: LongRestView = phase(), myParticipantId: number | null = 5): void {
    fixture.componentRef.setInput('pc', hero);
    fixture.componentRef.setInput('longRest', view);
    fixture.componentRef.setInput('myParticipantId', myParticipantId);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LongRestModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(LongRestModalComponent);
    component = fixture.componentInstance;
  });

  it('shows what the rest will restore: Hit Points now to max, the gain, Hit Dice, Exhaustion, Temp HP', () => {
    render(pc());

    expect(text()).toContain('This rest restores');
    expect(fixture.debugElement.query(By.css('.lr-hp-now')).nativeElement.textContent).toContain('18');
    expect(fixture.debugElement.query(By.css('.lr-hp-max')).nativeElement.textContent).toContain('44');
    expect(fixture.debugElement.query(By.css('.lr-gain')).nativeElement.textContent).toContain('+26');
    expect(row('hit-dice')).toContain('5 / 5 d10');
    expect(row('hit-dice')).toContain('+4');
    expect(row('exhaustion')).toContain('1');
    expect(row('exhaustion')).toContain('down from 2');
    expect(row('temp-hp')).toContain('5 will fade');
    expect(fixture.debugElement.query(By.css('.lr-bar')).attributes['aria-label'])
      .toBe('Hit Points go from 18 to 44');
    expect(component.hpNowPercent()).toBe(41);
  });

  it('leaves out Exhaustion and Temp HP when there is none, and shows a full hero plainly', () => {
    render(pc({ hp: { cur: 44, max: 44, temp: 0 }, hitDiceUsed: 0, exhaustion: 0 }));

    expect(fixture.debugElement.query(By.css('[data-row="exhaustion"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[data-row="temp-hp"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.lr-gain'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.lr-hp-now'))).toBeNull();
    expect(row('hit-dice')).toContain('none spent');
    expect(fixture.debugElement.query(By.css('.lr-bar')).attributes['aria-label'])
      .toBe('Hit Points are full at 44');
  });

  it('lists the spell slots that come back for a caster, lowest level first', () => {
    render(pc({
      clazz: 'Wizard',
      spellSlots: { 2: { max: 3, used: 0 }, 1: { max: 4, used: 3 }, 3: { max: 0, used: 0 } },
    }));

    const rows = fixture.debugElement.queryAll(By.css('[data-row="slots"]'))
      .map(r => r.nativeElement.textContent.replace(/\s+/g, ' ').trim());
    expect(rows.length).toBe(2); // a level with no slots is not listed
    expect(rows[0]).toContain('Lv 1 slots');
    expect(rows[0]).toContain('4 / 4');
    expect(rows[0]).toContain('+3');
    expect(rows[1]).toContain('Lv 2 slots');
    expect(rows[1]).toContain('none spent');
  });

  it('shows no slot rows for a hero without spell slots', () => {
    render(pc());
    expect(fixture.debugElement.query(By.css('[data-row="slots"]'))).toBeNull();
  });

  it('Ready emits true; once ready the button becomes Not Ready and emits false', () => {
    const emitted: boolean[] = [];
    component.readyChange.subscribe(v => emitted.push(v));

    render(pc());
    fixture.debugElement.query(By.css('[data-ready]')).nativeElement.click();
    expect(emitted).toEqual([true]);

    const view = phase();
    view.readiness[0] = { ...view.readiness[0], ready: true };
    render(pc(), { ...view, readyCount: 2 });

    expect(fixture.debugElement.query(By.css('[data-ready]'))).toBeNull();
    expect(text()).toContain('Waiting on the rest of the party');
    expect(text()).toContain('2 of 3 ready');
    fixture.debugElement.query(By.css('[data-unready]')).nativeElement.click();
    expect(emitted).toEqual([true, false]);
  });

  it('a hero at 0 Hit Points is told they cannot benefit, and gets no Ready button', () => {
    const view = phase({ ableCount: 2 });
    view.readiness[0] = { ...view.readiness[0], cannotRest: true };
    render(pc({ hp: { cur: 0, max: 44, temp: 0 } }), view);

    expect(text()).toContain('Bex is at 0 Hit Points and cannot benefit from this long rest.');
    expect(fixture.debugElement.query(By.css('[data-ready]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.lr-summary'))).toBeNull();
    expect(text()).toContain('1 of 2 ready');
  });

  it('holds Ready back, with the reason, while a choice is still to be made', () => {
    const emitted: boolean[] = [];
    component.readyChange.subscribe(v => emitted.push(v));
    render(pc());
    fixture.componentRef.setInput('readyBlocked', 'Choose the weapon that carries your rune first.');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.debugElement.query(By.css('[data-ready]')).nativeElement;
    expect(button.disabled).toBeTrue();
    expect(button.getAttribute('aria-describedby')).toBe('lr-ready-blocked');
    expect(fixture.debugElement.query(By.css('#lr-ready-blocked')).nativeElement.textContent)
      .toContain('Choose the weapon that carries your rune first.');
    button.click();
    expect(emitted).toEqual([]);

    fixture.componentRef.setInput('readyBlocked', null);
    fixture.detectChanges();
    expect(button.disabled).toBeFalse();
    expect(fixture.debugElement.query(By.css('#lr-ready-blocked'))).toBeNull();
  });

  it('never blocks taking Ready back', () => {
    const view = phase();
    view.readiness[0] = { ...view.readiness[0], ready: true };
    render(pc(), view);
    fixture.componentRef.setInput('readyBlocked', 'Choose the weapon that carries your rune first.');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.debugElement.query(By.css('[data-unready]')).nativeElement;
    expect(button.disabled).toBeFalse();
  });

  it('shows the temporary Hit Points the Blood Rune leaves, instead of zero', () => {
    render(pc());
    fixture.componentRef.setInput('tempHpAfter', 8);
    fixture.detectChanges();
    expect(row('temp-hp')).toContain('8');
    expect(row('temp-hp')).toContain('from the Blood Rune');

    // Also for a hero who had no temporary Hit Points coming in.
    render(pc({ hp: { cur: 18, max: 44, temp: 0 } }));
    expect(row('temp-hp')).toContain('from the Blood Rune');
  });

  it('names the class the way the sheet does: an Ebon Blade paladin is a Death Knight', () => {
    render(pc({ name: 'Thorne', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Blood' }));
    const sub = fixture.debugElement.query(By.css('.modal-sub')).nativeElement.textContent;
    expect(sub).toContain('Thorne · Death Knight (Paladin) 5');

    render(pc());
    expect(fixture.debugElement.query(By.css('.modal-sub')).nativeElement.textContent).toContain('Bex · Fighter 5');
  });

  it('is a blocking dialog: no close button', () => {
    render(pc());
    expect(fixture.debugElement.query(By.css('.modal-close'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.modal-title')).nativeElement.textContent).toContain('Long Rest');
  });
});

// The two projection slots later slices build on.
@Component({
  imports: [LongRestModalComponent],
  template: `
    <app-long-rest-modal [longRest]="view" [pc]="hero" [myParticipantId]="5">
      <div longRestRestored class="probe-restored">Second Wind</div>
      <div longRestChoices class="probe-choices">Prepare spells</div>
    </app-long-rest-modal>`,
})
class SlotHostComponent {
  hero = { id: 7, name: 'Bex', clazz: 'Fighter', level: 5, hp: { cur: 18, max: 44, temp: 0 } } as PC;
  view: LongRestView = {
    advanceClock: true, undisturbed: true, readyCount: 0, ableCount: 1,
    readiness: [{ participantId: 5, pcId: 7, displayName: 'Bex', ready: false, cannotRest: false, clazz: null, subclass: null, specialization: null, level: null }],
    myChoices: null,
  };
}

describe('LongRestModalComponent projection slots', () => {
  it('puts restored features inside the summary and choices between the summary and Ready', async () => {
    await TestBed.configureTestingModule({ imports: [SlotHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SlotHostComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const summary = root.querySelector('.lr-summary')!;
    const restored = root.querySelector('.probe-restored')!;
    const choices = root.querySelector('.probe-choices')!;
    const foot = root.querySelector('.lr-foot')!;

    expect(summary.contains(restored)).toBeTrue();
    expect(summary.contains(choices)).toBeFalse();
    // DOCUMENT_POSITION_FOLLOWING (4): the argument comes after the receiver.
    expect(summary.compareDocumentPosition(choices) & 4).toBe(4);
    expect(choices.compareDocumentPosition(foot) & 4).toBe(4);
  });
});
