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

  describe('Demon Hunter', () => {
    function makeDemonHunter(overrides: Partial<PC> = {}): PC {
      return {
        id: 8, name: 'Shalassa', clazz: 'Ranger', subclass: 'Demon Hunter', specialization: 'Havoc',
        level: 7, playerName: 'Gina', stats: { STR: 10, DEX: 17, CON: 14, INT: 10, WIS: 14, CHA: 8 },
        ...overrides,
      };
    }

    it('shows the bare specialization name and the Arcane Focus feature', () => {
      component.pc = makeDemonHunter();
      expect(component.specializationTitle).toBe('Havoc');
      expect(component.specializationDesc).toContain('melee');
      expect(component.hero?.level1Feature.desc).toContain('Arcane Focus');
    });

    it('lists the Demon Hunter spells for the level and specialization', () => {
      component.pc = makeDemonHunter();
      expect(component.spells.map(s => s.name))
        .toEqual(['Throw Glaive', 'Fel Rush', 'Sigil of Flame', 'Eye Beam']);
      component.pc = makeDemonHunter({ specialization: 'Devourer', level: 9 });
      expect(component.spells.map(s => s.name)).toEqual([
        'Throw Glaive', 'Consume Soul', 'Sigil of Flame', 'Misty Step', 'Metamorphosis', 'Soul Reap',
      ]);
      component.pc = makeDemonHunter({ specialization: 'Vengeance', level: 20 });
      expect(component.spells.slice(-2).map(s => s.name)).toEqual(['Destructive Wave', 'Sigil of Chains']);
      expect(component.spells.length).toBe(10);
    });

    it('has no spells or Soul Fragments before Ranger 3', () => {
      component.pc = makeDemonHunter({ level: 2 });
      expect(component.spells).toEqual([]);
      expect(component.resource).toBeNull();
      expect(dndResources.getSpells).not.toHaveBeenCalled();
    });

    it('grants Soul Fragments = WIS mod per Long Rest at 3, +1 at 13, +2 at 17', () => {
      const wis = (WIS: number) => ({ STR: 10, DEX: 10, CON: 10, INT: 10, WIS, CHA: 10 });
      component.pc = makeDemonHunter({ level: 3, stats: wis(16) });     // +3
      expect(component.resource).toEqual({ name: 'Soul Fragments', amount: '3 per Long Rest', fromLevel: 3 });
      component.pc = makeDemonHunter({ level: 12, stats: wis(16) });
      expect(component.resource?.amount).toBe('3 per Long Rest');
      component.pc = makeDemonHunter({ level: 13, stats: wis(16) });
      expect(component.resource?.amount).toBe('4 per Long Rest');
      component.pc = makeDemonHunter({ level: 17, stats: wis(16) });
      expect(component.resource?.amount).toBe('5 per Long Rest');
    });

    it('never grants fewer than one Soul Fragment when WIS mod is 0 or less', () => {
      component.pc = makeDemonHunter({ level: 3, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } });
      expect(component.resource?.amount).toBe('1 per Long Rest');
      component.pc = makeDemonHunter({ level: 3, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 6, CHA: 10 } });
      expect(component.resource?.amount).toBe('1 per Long Rest');
      component.pc = makeDemonHunter({ level: 13, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 6, CHA: 10 } });
      expect(component.resource?.amount).toBe('2 per Long Rest');
    });
  });
});
