import { of } from 'rxjs';
import { DndSpell } from '../../../models/dnd-api.types';
import { SpellCarouselComponent } from './spell-carousel.component';

/**
 * Class-only tests (no TestBed) — the carousel's behavior is pure state
 * manipulation over the pinned list. DOM (scroll/flash) is exercised in-browser.
 */
function spell(name: string, over: Partial<DndSpell> = {}): DndSpell {
  return {
    name,
    level: 1,
    school: 'evocation',
    classes: ['wizard'],
    actionType: 'action',
    concentration: false,
    ritual: false,
    range: '60 feet',
    components: ['v', 's'],
    duration: 'Instantaneous',
    description: `${name} description`,
    ...over,
  };
}

describe('SpellCarouselComponent', () => {
  let component: SpellCarouselComponent;
  const fireball = spell('Fireball', { level: 3 });
  const shield = spell('Shield', { components: ['v', 's'] });

  beforeEach(() => {
    const dndResources = { getSpells: () => of([fireball, shield]) };
    component = new SpellCarouselComponent(dndResources as any);
    component.ngOnInit();
  });

  it('loads candidate spells on init', () => {
    expect(component.allSpells.length).toBe(2);
    expect(component.loadingSpells).toBeFalse();
  });

  it('pins a newly selected spell and closes the overlay', () => {
    component.openSearch();
    component.onSelectionChange([fireball]);
    expect(component.pinned).toEqual([fireball]);
    expect(component.searchOpen).toBeFalse();
    expect(component.focusedName).toBe('Fireball');
  });

  it('does not add a duplicate — focuses the existing card instead', () => {
    component.pinned = [fireball];
    // Picker emits a shorter array (an already-pinned spell was clicked).
    component.onSelectionChange([]);
    expect(component.pinned).toEqual([fireball]); // unchanged, not unpinned
    expect(component.focusedName).toBe('Fireball');
  });

  it('removes a card by spell', () => {
    component.pinned = [fireball, shield];
    component.remove(fireball);
    expect(component.pinned).toEqual([shield]);
  });

  it('reorders on drop', () => {
    component.pinned = [fireball, shield];
    component.drop({ previousIndex: 0, currentIndex: 1 } as any);
    expect(component.pinned.map(s => s.name)).toEqual(['Shield', 'Fireball']);
  });

  it('toggles collapsed state', () => {
    expect(component.collapsed).toBeFalse();
    component.toggleCollapsed();
    expect(component.collapsed).toBeTrue();
  });

  it('builds a component label with material text', () => {
    const s = spell('Identify', { components: ['v', 's', 'm'], material: 'a pearl worth 100 gp' });
    expect(component.componentLabel(s)).toBe('V, S, M (a pearl worth 100 gp)');
    expect(component.componentLabel(shield)).toBe('V, S');
  });
});
