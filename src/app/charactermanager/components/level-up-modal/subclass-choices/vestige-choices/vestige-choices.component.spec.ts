import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VestigeChoicesComponent, VestigePicks } from './vestige-choices.component';
import { VestigeChoicesOwed } from '../../../../models/arcana-subclasses';

describe('VestigeChoicesComponent', () => {
  let fixture: ComponentFixture<VestigeChoicesComponent>;
  let emitted: VestigePicks[];

  function render(owed: VestigeChoicesOwed, picks: VestigePicks = {}): HTMLElement {
    fixture = TestBed.createComponent(VestigeChoicesComponent);
    fixture.componentRef.setInput('owed', owed);
    fixture.componentRef.setInput('picks', picks);
    emitted = [];
    fixture.componentInstance.picksChange.subscribe(p => emitted.push(p));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element) => node.textContent!.replace(/\s+/g, ' ').trim();
  const names = (group: string) => Array.from(el().querySelectorAll(`${group} .vestige-option-name`)).map(text);
  const descs = (group: string) => Array.from(el().querySelectorAll(`${group} .vestige-option-desc`)).map(text);
  const pick = (group: string, name: string) => {
    const row = (Array.from(el().querySelectorAll(`${group} .subclass-option`)) as HTMLElement[])
      .find(r => text(r.querySelector('.vestige-option-name')!) === name)!;
    (row.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
  };

  it('asks for the type and the domain, each as a radio group of its options', () => {
    render({ type: true, domain: true });
    expect(names('.vestige-type-pick')).toEqual(['Celestial', 'Fiend', 'Undead']);
    expect(names('.vestige-domain-pick')).toEqual(['Life', 'Light', 'Trickery', 'War']);
    expect(Array.from(el().querySelectorAll('[role="radiogroup"]')).map(g => g.getAttribute('aria-label')))
      .toEqual(['Vestige type', 'Vestige Spells domain']);
    expect(Array.from(el().querySelectorAll('.subclass-label')).map(text))
      .toEqual(['Vestige type', 'Vestige Spells domain']);
    expect(el().querySelectorAll('input[type="radio"]').length).toBe(7);
    expect(el().querySelectorAll('input:checked').length).toBe(0);
  });

  it('says what each type brings and which spells each domain hands over first', () => {
    render({ type: true, domain: true });
    expect(descs('.vestige-type-pick')).toEqual([
      'Radiant damage and resistance. Divine Power: Healing Touch.',
      'Fire damage and resistance. Divine Power: Fiendish Swap.',
      'Necrotic damage and resistance. Divine Power: Cursed Invocation.',
    ]);
    expect(descs('.vestige-domain-pick')).toEqual([
      'Aid, Bless, Cure Wounds, Lesser Restoration',
      'Burning Hands, Faerie Fire, Scorching Ray, See Invisibility',
      'Charm Person, Disguise Self, Invisibility, Pass without Trace',
      'Guiding Bolt, Magic Weapon, Shield of Faith, Spiritual Weapon',
    ]);
  });

  it('shows only the group that is still owed', () => {
    render({ type: false, domain: true });
    expect(el().querySelector('.vestige-type-pick')).toBeNull();
    expect(names('.vestige-domain-pick').length).toBe(4);

    render({ type: true, domain: false });
    expect(names('.vestige-type-pick').length).toBe(3);
    expect(el().querySelector('.vestige-domain-pick')).toBeNull();
  });

  it('emits both picks whenever one is made, keeping the other', () => {
    render({ type: true, domain: true });
    pick('.vestige-type-pick', 'Fiend');
    expect(emitted).toEqual([{ vestigeType: 'Fiend' }]);

    fixture.componentRef.setInput('picks', { vestigeType: 'Fiend' });
    fixture.detectChanges();
    pick('.vestige-domain-pick', 'War');
    expect(emitted[1]).toEqual({ vestigeType: 'Fiend', vestigeDomain: 'War' });
  });

  it('marks the picked options', () => {
    render({ type: true, domain: true }, { vestigeType: 'Undead', vestigeDomain: 'Life' });
    const selected = Array.from(el().querySelectorAll('.subclass-option.is-selected .vestige-option-name')).map(text);
    expect(selected).toEqual(['Undead', 'Life']);
    expect((Array.from(el().querySelectorAll('input:checked')) as HTMLInputElement[]).map(i => i.value))
      .toEqual(['Undead', 'Life']);
  });
});
