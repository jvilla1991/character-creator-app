import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanionVitalsComponent } from './companion-vitals.component';
import { PC } from '../../../../models/pc';

describe('CompanionVitalsComponent', () => {
  let fixture: ComponentFixture<CompanionVitalsComponent>;
  let emitted: PC[];

  const vestige = (over: Partial<PC> = {}): PC => ({
    id: -3, name: 'Vestige', clazz: 'Vestige', level: 5, playerName: 'Sam', ac: 17,
    hp: { max: 24, cur: 11, temp: 2 }, conditions: ['poisoned'],
    conditionImmunities: ['charmed', 'frightened', 'prone'],
    ...over,
  });

  function render(pc: PC, canEdit: boolean): HTMLElement {
    fixture = TestBed.createComponent(CompanionVitalsComponent);
    fixture.componentRef.setInput('pc', pc);
    fixture.componentRef.setInput('canEdit', canEdit);
    emitted = [];
    fixture.componentInstance.pcChange.subscribe(pc => emitted.push(pc));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const inputs = () => Array.from(el().querySelectorAll('input')) as HTMLInputElement[];
  const chip = (name: string) => (Array.from(el().querySelectorAll('.condition')) as HTMLButtonElement[])
    .find(c => c.firstChild!.textContent!.trim() === name)!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('shows the Hit Points over their maximum, the temporary Hit Points and every condition', () => {
    render(vestige(), true);
    expect(el().querySelector('.panel-title')!.textContent!.trim()).toBe('Hit Points and Conditions');
    expect(Array.from(el().querySelectorAll('label')).map(l => l.textContent!.trim()))
      .toEqual(['Hit Points', 'Temporary Hit Points']);
    expect(inputs().map(i => i.value)).toEqual(['11', '2']);
    expect(el().querySelector('.companion-hp-max')!.textContent!.trim()).toBe('/ 24');
    expect(inputs().every(i => !!i.id && el().querySelector(`label[for="${i.id}"]`))).toBeTrue();
    expect(el().querySelectorAll('.condition').length).toBe(17);
  });

  it('marks what it has red and what it is immune to green', () => {
    render(vestige(), true);
    expect(chip('poisoned').classList).toContain('active');
    expect(chip('poisoned').getAttribute('aria-pressed')).toBe('true');
    expect(chip('poisoned').textContent).toContain(', has it');
    for (const immune of ['charmed', 'frightened', 'prone']) {
      expect(chip(immune).classList).withContext(immune).toContain('immune');
      expect(chip(immune).classList).not.toContain('active');
      expect(chip(immune).getAttribute('aria-disabled')).toBe('true');
      expect(chip(immune).textContent).toContain(', immune');
    }
    expect(chip('blinded').classList).not.toContain('active');
    expect(chip('blinded').getAttribute('aria-pressed')).toBe('false');
  });

  it('puts a condition on and takes it off, emitting the whole sheet', () => {
    render(vestige(), true);
    chip('blinded').click();
    expect(emitted.length).toBe(1);
    expect(emitted[0].conditions).toEqual(['poisoned', 'blinded']);
    expect(emitted[0].ac).toBe(17);
    expect(emitted[0].hp).toEqual({ max: 24, cur: 11, temp: 2 });

    chip('poisoned').click();
    expect(emitted[1].conditions).toEqual([]);
  });

  it('never sets a condition the companion is immune to', () => {
    render(vestige(), true);
    chip('prone').click();
    chip('charmed').click();
    expect(emitted).toEqual([]);
  });

  it('saves a typed Hit Point value, whole, between zero and the maximum', () => {
    render(vestige(), true);
    const [current] = inputs();

    type(current, '7');
    expect(emitted[0].hp).toEqual({ max: 24, cur: 7, temp: 2 });
    type(current, '99');
    expect(emitted[1].hp!.cur).toBe(24);
    expect(current.value).toBe('24');
    type(current, '-4');
    expect(emitted[2].hp!.cur).toBe(0);
    type(current, '6.9');
    expect(emitted[3].hp!.cur).toBe(6);
    // An emptied field, or the value it already has: nothing to save, and the stored value is shown again.
    type(current, '');
    expect(current.value).toBe('11');
    type(current, '11');
    expect(emitted.length).toBe(4);
  });

  it('saves temporary Hit Points, never negative and with no upper limit', () => {
    render(vestige(), true);
    const temporary = inputs()[1];

    type(temporary, '40');
    expect(emitted[0].hp).toEqual({ max: 24, cur: 11, temp: 40 });
    type(temporary, '-1');
    expect(emitted[1].hp!.temp).toBe(0);
    type(temporary, '2');
    expect(emitted.length).toBe(2);   // already 2
  });

  it('is inert for a viewer who is neither the owner nor the DM', () => {
    render(vestige(), false);
    expect(inputs().every(i => i.disabled)).toBeTrue();
    expect(chip('blinded').getAttribute('aria-disabled')).toBe('true');
    chip('blinded').click();
    chip('poisoned').click();
    expect(emitted).toEqual([]);
    // What it shows is the same.
    expect(inputs().map(i => i.value)).toEqual(['11', '2']);
    expect(chip('poisoned').classList).toContain('active');
  });

  it('reads a sheet with no Hit Points as zeroes', () => {
    render(vestige({ hp: undefined, conditions: undefined, conditionImmunities: undefined }), true);
    expect(inputs().map(i => i.value)).toEqual(['0', '0']);
    expect(el().querySelector('.condition.active')).toBeNull();
    expect(el().querySelector('.condition.immune')).toBeNull();
  });
});
