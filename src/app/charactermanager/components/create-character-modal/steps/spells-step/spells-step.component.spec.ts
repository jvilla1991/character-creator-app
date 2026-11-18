import { TestBed } from '@angular/core/testing';
import { SpellsStepComponent } from './spells-step.component';
import { DndSpell } from '../../../../models/dnd-api.types';

describe('spell creation level groups', () => {
  it('collapses levels independently and preserves selection through filtering', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const cantrip: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    const first: DndSpell = { ...cantrip, name: 'Shield', level: 1, school: 'abjuration' };
    fixture.componentRef.setInput('filteredSpellList', [first, cantrip]);
    fixture.componentRef.setInput('selectedSpells', [cantrip]);
    fixture.detectChanges();
    const groups = fixture.nativeElement.querySelectorAll('details') as NodeListOf<HTMLDetailsElement>;
    expect(groups.length).toBe(2);
    expect(groups[0].querySelector('summary')!.textContent).toContain('Cantrips');
    groups[0].querySelector('summary')!.click();
    expect(groups[0].open).toBeFalse();
    expect(groups[1].open).toBeTrue();
    fixture.componentRef.setInput('filteredSpellList', [cantrip]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('details').open).toBeFalse();
    expect(fixture.componentInstance.isSpellSelected(cantrip)).toBeTrue();
  });

  it('folds a group away once its allowance is spent, and reopens it when a slot frees up', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const cantrip: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    const first: DndSpell = { ...cantrip, name: 'Shield', level: 1, school: 'abjuration' };
    fixture.componentRef.setInput('filteredSpellList', [cantrip, first]);
    fixture.componentRef.setInput('maxCantrips', 1);
    fixture.componentRef.setInput('maxKnownSpells', 1);
    fixture.componentRef.setInput('selectedCantrips', 1);
    fixture.componentRef.setInput('selectedLeveled', 0);
    fixture.detectChanges();

    const groups = fixture.nativeElement.querySelectorAll('details') as NodeListOf<HTMLDetailsElement>;
    // Cantrips are done, so that group folds; the 1st-level list stays open.
    expect(groups[0].open).toBeFalse();
    expect(groups[1].open).toBeTrue();

    fixture.componentRef.setInput('selectedLeveled', 1);
    fixture.detectChanges();
    expect(groups[1].open).toBeFalse();

    // Removing a cantrip hands the slot back and the list comes out again.
    fixture.componentRef.setInput('selectedCantrips', 0);
    fixture.detectChanges();
    expect(groups[0].open).toBeTrue();
  });

  it('leaves a group open when the class has no picks of that kind', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const cantrip: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    fixture.componentRef.setInput('filteredSpellList', [cantrip]);
    fixture.componentRef.setInput('maxCantrips', 0);
    fixture.componentRef.setInput('selectedCantrips', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('details').open).toBeTrue();
  });

  it('badges recommended spells without selecting them', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const base: DndSpell = { name: 'Druidcraft', level: 0, school: 'transmutation',
      classes: ['druid'], actionType: 'action', concentration: false, ritual: false,
      range: '30 feet', components: ['v', 's'], duration: 'Instantaneous', description: 'Nature trick.' };
    const wrath: DndSpell = { ...base, name: 'Wrath', school: 'evocation', source: 'World of Warcraft' };
    const shillelagh: DndSpell = { ...base, name: 'Shillelagh' };
    fixture.componentRef.setInput('filteredSpellList', [base, wrath, shillelagh]);
    fixture.componentRef.setInput('recommendedSpells', ['Druidcraft', 'wrath']);
    fixture.componentRef.setInput('recommendedFor', 'Balance');
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.isRecommended(base)).toBeTrue();
    expect(cmp.isRecommended(wrath)).toBeTrue();
    expect(cmp.isRecommended(shillelagh)).toBeFalse();
    const badges = fixture.nativeElement.querySelectorAll('.spell-recommended-badge') as NodeListOf<HTMLElement>;
    expect(badges.length).toBe(2);
    expect(badges[0].getAttribute('title')).toBe('Recommended for Balance');
    expect(fixture.nativeElement.querySelectorAll('.spell-selected-badge').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('suit the Balance specialization');
  });

  it('shows no recommendation badges by default', () => {
    const fixture = TestBed.createComponent(SpellsStepComponent);
    const light: DndSpell = { name: 'Light', level: 0, school: 'evocation',
      classes: ['wizard'], actionType: 'action', concentration: false, ritual: false,
      range: 'Touch', components: ['v'], duration: '1 hour', description: 'Creates light.' };
    fixture.componentRef.setInput('filteredSpellList', [light]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.spell-recommended-badge').length).toBe(0);
  });
});
