import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HeroClassPanelComponent, isHeroClass } from './hero-class-panel.component';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC } from '../../../../models/pc';

function makeDeathKnight(overrides: Partial<PC> = {}): PC {
  return {
    id: 6, name: 'Isolde', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost',
    level: 5, playerName: 'Frank', stats: { STR: 17, DEX: 10, CON: 15, INT: 8, WIS: 12, CHA: 14 },
    ...overrides,
  };
}

describe('HeroClassPanelComponent', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let component: HeroClassPanelComponent;

  const deathGrip = {
    name: 'Death Grip', level: 1, school: 'necromancy', classes: [], actionType: 'action',
    concentration: false, ritual: false, range: 'TBD', components: ['v', 's'], duration: 'TBD',
    description: 'Stub text.', source: 'World of Warcraft',
  } as DndSpell;

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of([deathGrip]));
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
    component = TestBed.runInInjectionContext(() => new HeroClassPanelComponent());
  });

  it('recognizes hero-class characters by base class + subclass', () => {
    expect(isHeroClass(makeDeathKnight())).toBeTrue();
    expect(isHeroClass(makeDeathKnight({ subclass: 'Oath of Devotion' }))).toBeFalse();
    expect(isHeroClass(makeDeathKnight({ clazz: 'Fighter' }))).toBeFalse();
    expect(isHeroClass(null)).toBeFalse();
  });

  describe('Death Knight', () => {
    it('lists the oath spells for the level and rune', () => {
      component.pc = makeDeathKnight();
      expect(component.spells.map(s => s.name))
        .toEqual(['Rune Strike', 'Death Grip', 'Chains of Ice', 'Death and Decay', 'Frostscythe']);
    });

    it('loads spell data once and looks spells up by name', () => {
      component.pc = makeDeathKnight();
      component.pc = makeDeathKnight({ level: 6 });
      expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
      expect(component.spellFor('death grip')?.description).toBe('Stub text.');
    });

    it('does not fetch spells at level 1 (no oath spells yet)', () => {
      component.pc = makeDeathKnight({ level: 1 });
      expect(component.spells).toEqual([]);
      expect(dndResources.getSpells).not.toHaveBeenCalled();
    });

    it('sizes the Death Coil pool at 1 + CHA modifier, never below one die', () => {
      component.pc = makeDeathKnight();                               // CHA 14 → +2
      expect(component.resource).toEqual({ name: 'Death Coil pool', amount: '3d8', fromLevel: 1 });
      component.pc = makeDeathKnight({ level: 1, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 6 } });
      expect(component.resource?.amount).toBe('1d8');
    });

    it('shows Death Coil as the level-1 feature', () => {
      component.pc = makeDeathKnight();
      expect(component.hero?.level1Feature.name).toBe('Death Coil');
    });

    it('titles and describes the chosen rune', () => {
      component.pc = makeDeathKnight({ specialization: 'Blood' });
      expect(component.specializationTitle).toBe('Blood Rune');
      expect(component.specializationDesc).toContain('tank');
    });
  });
});
