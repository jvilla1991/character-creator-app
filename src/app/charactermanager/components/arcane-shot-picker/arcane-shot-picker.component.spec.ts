import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArcaneShotPickerComponent } from './arcane-shot-picker.component';
import { ArcaneShotRule } from '../../models/arcane-shots';

describe('ArcaneShotPickerComponent', () => {
  let fixture: ComponentFixture<ArcaneShotPickerComponent>;
  let changes: string[][];

  function render(rule: ArcaneShotRule, selected: string[], level = 3): HTMLElement {
    fixture = TestBed.createComponent(ArcaneShotPickerComponent);
    fixture.componentRef.setInput('rule', rule);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('level', level);
    changes = [];
    // A host keeps the selection: here the list is handed straight back.
    fixture.componentInstance.selectedChange.subscribe(next => {
      changes.push(next);
      fixture.componentRef.setInput('selected', next);
    });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('.shot-option')) as HTMLElement[];
  const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const row = (name: string) => rows().find(r => text(r.querySelector('.shot-name')) === name)!;
  const box = (name: string) => row(name).querySelector('input') as HTMLInputElement;
  function tick(name: string): void {
    box(name).click();
    fixture.detectChanges();
  }

  it('lists the eight options as labelled checkboxes, with damage for the level, save and summary', () => {
    render({ known: [], count: 2, swaps: 0 }, [], 15);
    expect(rows().length).toBe(8);
    expect(rows().every(r => r.tagName === 'LABEL' && (r.querySelector('input') as HTMLInputElement).type === 'checkbox')).toBeTrue();
    expect(text(row('Grasping Shot').querySelector('.shot-meta'))).toBe('1d10 Slashing · Strength save');
    expect(text(row('Bursting Shot').querySelector('.shot-meta'))).toBe('2d10 Force');
    expect(text(row('Shadow Shot').querySelector('.shot-summary'))).toContain('Blinded');
    expect(el().querySelector('.shot-known')).toBeNull();
  });

  it('marks what the character knows, and what is ticked', () => {
    render({ known: ['Seeking Shot'], count: 3, swaps: 0 }, ['Seeking Shot', 'Shadow Shot']);
    expect(rows().filter(r => !!r.querySelector('.shot-known')).map(r => text(r.querySelector('.shot-name')))).toEqual(['Seeking Shot']);
    expect(text(row('Seeking Shot').querySelector('.shot-known'))).toBe('Known');
    expect(rows().filter(r => r.classList.contains('is-selected')).map(r => text(r.querySelector('.shot-name'))))
      .toEqual(['Seeking Shot', 'Shadow Shot']);
    expect(box('Seeking Shot').checked && box('Shadow Shot').checked).toBeTrue();
  });

  it('reports each tick, and disables every box whose change the rule does not allow', () => {
    render({ known: ['Seeking Shot'], count: 2, swaps: 0 }, ['Seeking Shot']);
    expect(box('Seeking Shot').disabled).toBeTrue();   // known, and no swap
    expect(rows().filter(r => r.classList.contains('is-blocked')).length).toBe(1);
    tick('Banishing Shot');
    expect(changes).toEqual([['Seeking Shot', 'Banishing Shot']]);
    // Full: only the new pick can still change.
    expect(rows().filter(r => !(r.querySelector('input') as HTMLInputElement).disabled).map(r => text(r.querySelector('.shot-name'))))
      .toEqual(['Banishing Shot']);
    tick('Banishing Shot');
    expect(changes[1]).toEqual(['Seeking Shot']);
    // A change the rule refuses is not reported, however it is asked for.
    fixture.componentInstance.toggle('Seeking Shot');
    fixture.componentInstance.toggle('Exploding Shot');
    expect(changes.length).toBe(2);
  });

  it('lets a known option be unticked where the rule allows a swap', () => {
    render({ known: ['Seeking Shot', 'Shadow Shot'], count: 3, swaps: 1 }, ['Seeking Shot', 'Shadow Shot']);
    expect(box('Seeking Shot').disabled).toBeFalse();
    tick('Seeking Shot');
    expect(changes).toEqual([['Shadow Shot']]);
    expect(box('Shadow Shot').disabled).toBeTrue();   // one swap only
    expect(box('Seeking Shot').disabled).toBeFalse();   // it can come back
  });

  it('keeps the boxes of two lists on one page apart', () => {
    render({ known: [], count: 2, swaps: 0 }, []);
    const first = box('Seeking Shot').name;
    render({ known: [], count: 2, swaps: 0 }, []);
    expect(box('Seeking Shot').name).not.toBe(first);
  });
});
