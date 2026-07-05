import { SpellPickerComponent } from './spell-picker.component';
import { DndSpell } from '../../models/dnd-api.types';

function dndSpell(level: number, name: string): DndSpell {
  return {
    name, level, school: 'evocation', classes: ['bard'], actionType: '1 action',
    concentration: false, ritual: false, range: '60 feet', components: ['v'],
    duration: 'Instantaneous', description: '',
  };
}

/** Captures the most recent selectedChange emission without tripping TS's narrowing on reassignment. */
function captureEmissions(component: SpellPickerComponent): { value: DndSpell[] | null } {
  const box: { value: DndSpell[] | null } = { value: null };
  component.selectedChange.subscribe(v => { box.value = v; });
  return box;
}

describe('SpellPickerComponent', () => {
  let component: SpellPickerComponent;

  beforeEach(() => {
    component = new SpellPickerComponent();
  });

  // --- search filter ---

  it('shows all candidates with no search and no limits', () => {
    component.spells = [dndSpell(0, 'Light'), dndSpell(1, 'Heroism')];
    expect(component.filteredSpells.map(s => s.name)).toEqual(['Light', 'Heroism']);
  });

  it('filters by a case-insensitive name substring', () => {
    component.spells = [dndSpell(1, 'Hold Person'), dndSpell(1, 'Heroism')];
    component.search = 'her';
    expect(component.filteredSpells.map(s => s.name)).toEqual(['Heroism']);
  });

  // --- kind hidden at limit 0 (current filteredSpells semantics) ---

  it('hides cantrips when cantripLimit is 0', () => {
    component.spells = [dndSpell(0, 'Light'), dndSpell(1, 'Heroism')];
    component.cantripLimit = 0;
    component.spellLimit = 2;
    expect(component.filteredSpells.map(s => s.name)).toEqual(['Heroism']);
  });

  it('hides leveled spells when spellLimit is 0', () => {
    component.spells = [dndSpell(0, 'Light'), dndSpell(1, 'Heroism')];
    component.cantripLimit = 1;
    component.spellLimit = 0;
    expect(component.filteredSpells.map(s => s.name)).toEqual(['Light']);
  });

  // --- limit enforcement ---

  it('rejects toggling on past the limit for that kind', () => {
    const spells = [dndSpell(1, 'A'), dndSpell(1, 'B'), dndSpell(1, 'C')];
    component.spells = spells;
    component.spellLimit = 2;
    component.selected = [];

    const box = captureEmissions(component);

    component.toggle(spells[0]);
    component.selected = box.value ?? [];
    component.toggle(spells[1]);
    component.selected = box.value ?? [];

    expect(component.selected.length).toBe(2);

    component.toggle(spells[2]); // exceeds the limit -> ignored, no new emit
    expect(box.value?.length).toBe(2);
  });

  it('allows deselecting even when already at the limit', () => {
    const spells = [dndSpell(1, 'A'), dndSpell(1, 'B')];
    component.spells = spells;
    component.spellLimit = 2;
    component.selected = spells;

    const box = captureEmissions(component);

    component.toggle(spells[0]);

    expect(box.value).toEqual([spells[1]]);
  });

  it('rejects toggling on a cantrip past cantripLimit independently of spellLimit', () => {
    const cantrips = [dndSpell(0, 'Light'), dndSpell(0, 'Fire Bolt')];
    component.spells = cantrips;
    component.cantripLimit = 1;
    component.spellLimit = 5;
    component.selected = [cantrips[0]];

    const box = captureEmissions(component);

    component.toggle(cantrips[1]);

    expect(box.value).toBeNull();
  });

  // --- unlimited when null ---

  it('never blocks selection when the relevant limit is null', () => {
    const spells = [dndSpell(1, 'A'), dndSpell(1, 'B'), dndSpell(1, 'C')];
    component.spells = spells;
    component.spellLimit = null;
    component.selected = [spells[0], spells[1]];

    const box = captureEmissions(component);

    component.toggle(spells[2]);

    expect(box.value).toEqual([spells[0], spells[1], spells[2]]);
  });

  it('never hides a kind when the limit is null', () => {
    component.spells = [dndSpell(0, 'Light'), dndSpell(1, 'Heroism')];
    component.cantripLimit = null;
    component.spellLimit = null;
    expect(component.filteredSpells.map(s => s.name)).toEqual(['Light', 'Heroism']);
  });

  // --- emits a new array ---

  it('emits a new array reference on toggle-on', () => {
    const spells = [dndSpell(1, 'A')];
    component.spells = spells;
    component.selected = [];

    const box = captureEmissions(component);

    component.toggle(spells[0]);

    expect(box.value).not.toBe(component.selected);
    expect(box.value).toEqual([spells[0]]);
  });

  it('emits a new array reference on toggle-off', () => {
    const spells = [dndSpell(1, 'A')];
    component.spells = spells;
    component.selected = spells;

    const box = captureEmissions(component);

    component.toggle(spells[0]);

    expect(box.value).not.toBe(component.selected);
    expect(box.value).toEqual([]);
  });

  // --- isSelected ---

  it('reports selection state by spell name', () => {
    const spells = [dndSpell(1, 'A'), dndSpell(1, 'B')];
    component.selected = [spells[0]];
    expect(component.isSelected(spells[0])).toBeTrue();
    expect(component.isSelected(spells[1])).toBeFalse();
  });
});
