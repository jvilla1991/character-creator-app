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
      expect(component.hero?.level1Feature?.name).toBe('Death Coil');
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
      expect(component.hero?.level1Feature?.desc).toContain('Arcane Focus');
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

  describe('World of Warcraft Druid', () => {
    function makeDruid(overrides: Partial<PC> = {}): PC {
      return {
        id: 8, name: 'Hrogar', clazz: 'Druid', subclass: 'Circle of the Moon', specialization: 'Guardian',
        level: 6, prof: 3, playerName: 'Hank', stats: { STR: 14, DEX: 10, CON: 16, INT: 8, WIS: 17, CHA: 10 },
        spells: [
          { lvl: 2, name: 'Barkskin', prepared: true } as any,
          { lvl: 2, name: 'Aid', prepared: false } as any,
        ],
        ...overrides,
      };
    }

    it('renders for a WoW druid but not for a base druid', () => {
      expect(isHeroClass(makeDruid())).toBeTrue();
      expect(isHeroClass(makeDruid({ subclass: undefined }))).toBeTrue();
      expect(isHeroClass(makeDruid({ specialization: null }))).toBeFalse();
    });

    it('titles the panel and shows the spec, renown reminder and no level-1 feature', () => {
      component.pc = makeDruid();
      expect(component.panelTitle).toBe('World of Warcraft Druid');
      expect(component.specializationTitle).toBe('Guardian');
      expect(component.specializationDesc).toContain('bear');
      expect(component.hero?.renownNote).toContain('Cenarion Circle');
      expect(component.hero?.level1Feature).toBeUndefined();
      expect(component.spells).toEqual([]);
      expect(component.resource).toBeNull();
    });

    it('compares the actual circle with the recommended one (informational)', () => {
      component.pc = makeDruid();
      expect(component.guidance?.subclass.name).toBe('Circle of the Moon');
      expect(component.subclassMatch).toBe('match');
      component.pc = makeDruid({ subclass: 'Circle of the Land' });
      expect(component.subclassMatch).toBe('different');
      component.pc = makeDruid({ subclass: undefined, level: 2 });
      expect(component.subclassMatch).toBe('pending');
      component.pc = makeDruid({ specialization: 'Balance', subclass: 'Circle of the Stars' });
      expect(component.subclassMatch).toBe('match');
    });

    it('lists the suggested spells by level and marks what the character has', () => {
      component.pc = makeDruid();
      expect(component.suggestedSpells.map(r => r.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      expect(component.suggestedSpells[0].spells).toEqual([
        { name: 'Aid', known: true, prepared: false },
        { name: 'Barkskin', known: true, prepared: true },
        { name: 'Roar of Ursoc', known: false, prepared: false },
      ]);
      expect(dndResources.getSpells).toHaveBeenCalledTimes(1);   // for the WoW-stub marks
      component.pc = makeDruid({ specialization: 'Restoration' });
      expect(component.suggestedSpells[1].spells.map(s => s.name)).toEqual(['Aura of Vitality', 'Regrowth', 'Revivify']);
      expect(component.guidance?.tip).toBeUndefined();
      component.pc = makeDruid({ specialization: 'Feral' });
      expect(component.guidance?.tip).toContain('Wild Resurgence');
    });

    it('marks World of Warcraft stub spells from the loaded data', () => {
      dndResources.getSpells.and.returnValue(of([
        { ...deathGrip, name: 'Roar of Ursoc', classes: ['druid'] } as DndSpell,
        { ...deathGrip, name: 'Aid', source: undefined } as DndSpell,
      ]));
      component.pc = makeDruid();
      expect(component.isWowSpell('Roar of Ursoc')).toBeTrue();
      expect(component.isWowSpell('Aid')).toBeFalse();
    });

    it('builds Cat and Bear Form cards from the sheet for Circle of the Moon (level 6, WIS 17)', () => {
      component.pc = makeDruid();
      const [cat, bear] = component.formCards;
      expect(cat.name).toBe('Cat Form');
      expect(cat.ac).toBe(16);                                    // 13 + 3
      expect(cat.tempHp).toBe(18);
      expect(cat.strDex).toBe(17);
      expect(cat.attacks[0]).toEqual({ name: 'Pounce', toHit: 6, reach: '5 ft.', damage: '2d10 + 3 slashing' });
      expect(cat.actions[1].text).toContain('DC 14');           // 8 + 3 + 3
      expect(bear.ac).toBe(18);
      expect(bear.attacks[0].damage).toBe('2d8 + 3 slashing');
      expect(component.isEmphasized(bear)).toBeTrue();
      expect(component.isEmphasized(cat)).toBeFalse();
      component.pc = makeDruid({ specialization: 'Feral' });
      expect(component.isEmphasized(component.formCards[0])).toBeTrue();
      // Moon druids still see the travel/aquatic/flight beasts.
      expect(component.classicForms.map(f => f.form)).toEqual(['Travel Form', 'Aquatic Form', 'Flight Form']);
    });

    it('shows classic beasts (no stat cards) for a WoW druid outside the Circle of the Moon', () => {
      component.pc = makeDruid({ subclass: 'Circle of the Land', level: 4 });
      expect(component.formCards).toEqual([]);
      expect(component.classicForms.filter(f => f.available).map(f => f.beast))
        .toEqual(['Panther', 'Black Bear', 'Elk', 'Giant Seahorse']);
    });

    it('renders the cards and suggestions in the template', () => {
      const fixture = TestBed.createComponent(HeroClassPanelComponent);
      fixture.componentRef.setInput('pc', makeDruid());
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('World of Warcraft Druid');
      expect(text).toContain('Recommended circle');
      expect(text).toContain('Suggested Guardian Spells');
      expect(text).toContain('Cat Form');
      expect(text).toContain('Bear Form');
      expect(text).toContain('Frenzied Regeneration');
      expect(text).toContain('Cenarion Circle');
      expect(fixture.nativeElement.querySelector('.form-card.emphasized')?.textContent).toContain('Bear Form');
    });
  });
});
