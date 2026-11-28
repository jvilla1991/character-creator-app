import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SubclassChoiceResult, SubclassChoicesComponent } from './subclass-choices.component';
import { DndResourcesService } from '../../../services/dnd-resources.service';
import { PC } from '../../../models/pc';

/** The Vestige Patron section of the subclass choices: the type and the domain, until each is stored. */
describe('SubclassChoicesComponent (Vestige Patron)', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let fixture: ComponentFixture<SubclassChoicesComponent>;
  let results: SubclassChoiceResult[];

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of([]));
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
    results = [];
  });

  function render(pc: Partial<PC>, newLevel: number, subclass: string | null = 'Vestige Patron'): HTMLElement {
    fixture = TestBed.createComponent(SubclassChoicesComponent);
    fixture.componentRef.setInput('pc',
      { id: 7, name: 'Aelindra', clazz: 'Warlock', subclass: 'Vestige Patron', level: newLevel - 1, playerName: 'Sam', ...pc });
    fixture.componentRef.setInput('subclass', subclass);
    fixture.componentRef.setInput('newLevel', newLevel);
    fixture.componentInstance.choicesChange.subscribe(result => results.push(result));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const last = () => results[results.length - 1];
  const pick = (group: string, name: string) => {
    const row = (Array.from(el().querySelectorAll(`${group} .subclass-option`)) as HTMLElement[])
      .find(r => r.querySelector('.vestige-option-name')!.textContent!.trim() === name)!;
    (row.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
  };

  it('asks a Vestige Patron reaching Warlock 3 for its type and its domain', () => {
    render({}, 3);
    expect(el().querySelector('app-vestige-choices .vestige-type-pick')).not.toBeNull();
    expect(el().querySelector('app-vestige-choices .vestige-domain-pick')).not.toBeNull();
    // Nothing is reported until the player picks; no spell data is needed for these choices.
    expect(results).toEqual([]);
    expect(dndResources.getSpells).not.toHaveBeenCalled();
    expect(fixture.componentInstance.result().valid).toBeFalse();
  });

  it('is not valid until both are picked, and then carries both keys', () => {
    render({}, 3);
    pick('.vestige-type-pick', 'Fiend');
    expect(last()).toEqual({ subclassChoices: { vestigeType: 'Fiend' }, newSpells: [], forgetSpells: [], valid: false });

    pick('.vestige-domain-pick', 'War');
    expect(last()).toEqual({
      subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' }, newSpells: [], forgetSpells: [], valid: true,
    });
    expect(Array.from(el().querySelectorAll('.is-selected .vestige-option-name')).map(n => n.textContent!.trim()))
      .toEqual(['Fiend', 'War']);

    // Changing a pick replaces it.
    pick('.vestige-type-pick', 'Undead');
    expect(last().subclassChoices).toEqual({ vestigeType: 'Undead', vestigeDomain: 'War' });
    expect(last().valid).toBeTrue();
  });

  it('asks only for what is still unset on a later level-up', () => {
    render({ subclassChoices: { vestigeType: 'Fiend' } }, 6);
    expect(el().querySelector('.vestige-type-pick')).toBeNull();
    expect(el().querySelector('.vestige-domain-pick')).not.toBeNull();
    pick('.vestige-domain-pick', 'Life');
    // The stored type is not sent again.
    expect(last()).toEqual({ subclassChoices: { vestigeDomain: 'Life' }, newSpells: [], forgetSpells: [], valid: true });

    render({ subclassChoices: { vestigeDomain: 'Life' } }, 6);
    expect(el().querySelector('.vestige-type-pick')).not.toBeNull();
    expect(el().querySelector('.vestige-domain-pick')).toBeNull();
    pick('.vestige-type-pick', 'Celestial');
    expect(last().subclassChoices).toEqual({ vestigeType: 'Celestial' });
    expect(last().valid).toBeTrue();
  });

  it('renders nothing once both are stored, below Warlock 3, or for another patron', () => {
    render({ subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' } }, 6);
    expect(el().querySelector('app-vestige-choices')).toBeNull();
    expect(fixture.componentInstance.result())
      .toEqual({ subclassChoices: {}, newSpells: [], forgetSpells: [], valid: true });

    render({}, 2);
    expect(el().querySelector('app-vestige-choices')).toBeNull();

    render({ subclass: 'Fiend Patron' }, 3, 'Fiend Patron');
    expect(el().querySelector('app-vestige-choices')).toBeNull();
    expect(el().textContent!.trim()).toBe('');

    render({ clazz: 'Wizard' }, 3);
    expect(el().querySelector('app-vestige-choices')).toBeNull();
  });
});
