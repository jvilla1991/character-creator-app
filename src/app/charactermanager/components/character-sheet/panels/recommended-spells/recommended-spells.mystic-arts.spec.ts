import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RecommendedSpellsComponent } from './recommended-spells.component';
import { PC } from '../../../../models/pc';
import { ClassFeatureService } from '../../../../services/class-feature.service';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

describe('RecommendedSpellsComponent (Warrior of the Mystic Arts)', () => {
  const pc = (overrides: Partial<PC>): PC => ({
    id: 1, name: 'Shen', clazz: 'Monk', level: 3, playerName: 'Sam', ...overrides,
  });

  beforeEach(() => {
    const dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of([]));
    const classFeatures = jasmine.createSpyObj<ClassFeatureService>('ClassFeatureService', ['progression']);
    classFeatures.progression.and.returnValue(of([]));
    TestBed.configureTestingModule({ providers: [
      { provide: DndResourcesService, useValue: dndResources },
      { provide: ClassFeatureService, useValue: classFeatures },
    ] });
  });

  function render(character: PC): HTMLElement {
    const fixture = TestBed.createComponent(RecommendedSpellsComponent);
    fixture.componentRef.setInput('pc', character);
    // The roadmap arrives through an effect-backed observable: settle it, then render the answer.
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texts = (el: HTMLElement, selector: string) =>
    Array.from(el.querySelectorAll(selector)).map(n => n.textContent!.replace(/\s+/g, ' ').trim());

  it('shows the picks Arcana Unleashed recommends at Monk level 3, sourced to the book', () => {
    const el = render(pc({ subclass: 'Warrior of the Mystic Arts' }));

    expect(texts(el, '.hero-spells-title')).toEqual(['Warrior of the Mystic Arts starting spells']);
    expect(texts(el, '.hero-spells-note')).toEqual([
      'Arcana Unleashed recommends these for a new Warrior of the Mystic Arts, at Monk level 3. They are suggestions only.',
    ]);
    expect(texts(el, 'dd')).toEqual(['Blade Ward, Thunderclap', 'Jump, Magic Missile, Shield']);
  });

  it('shows a Monk of another subclass nothing', () => {
    expect(render(pc({ subclass: 'Warrior of the Open Hand' })).textContent!.trim()).toBe('');
    expect(render(pc({})).textContent!.trim()).toBe('');
  });
});
