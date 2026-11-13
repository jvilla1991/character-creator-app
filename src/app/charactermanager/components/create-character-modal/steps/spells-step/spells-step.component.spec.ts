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
});
