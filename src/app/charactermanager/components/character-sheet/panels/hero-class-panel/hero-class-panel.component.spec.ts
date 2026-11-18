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

    it("finds Evard's Black Tentacles under its SRD name, Black Tentacles (Blood, Paladin 13)", () => {
      const tentacles = {
        ...deathGrip, name: 'Black Tentacles', level: 4, school: 'conjuration', description: 'Tentacle text.',
      } as DndSpell;
      dndResources.getSpells.and.returnValue(of([deathGrip, tentacles]));
      component.pc = makeDeathKnight({ specialization: 'Blood', level: 13 });
      expect(component.spells.map(s => s.name)).toContain("Evard's Black Tentacles");
      expect(component.spellFor("Evard's Black Tentacles")?.description).toBe('Tentacle text.');
      expect(component.spellFor('Black Tentacles')?.description).toBe('Tentacle text.');
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
  describe('World of Warcraft Paladin', () => {
    function makePaladin(overrides: Partial<PC> = {}): PC {
      return {
        id: 9, name: 'Aelira', clazz: 'Paladin', subclass: undefined, specialization: 'Protection',
        level: 2, prof: 2, playerName: 'Ivy', stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 12, CHA: 15 },
        spells: [
          { lvl: 1, name: 'Shield of Faith', prepared: true } as any,
          { lvl: 1, name: 'Heroism', prepared: false } as any,
        ],
        ...overrides,
      };
    }

    it('renders for a WoW paladin but not for a base paladin or a Death Knight', () => {
      expect(isHeroClass(makePaladin())).toBeTrue();
      expect(isHeroClass(makePaladin({ specialization: null, subclass: 'Oath of Devotion' }))).toBeFalse();
      component.pc = makeDeathKnight({ specialization: 'Blood' });
      expect(component.hero?.name).toBe('Death Knight');
      expect(component.guidance).toBeNull();
    });

    it('titles the panel and shows the spec description', () => {
      component.pc = makePaladin();
      expect(component.panelTitle).toBe('World of Warcraft Paladin');
      expect(component.specializationTitle).toBe('Protection');
      expect(component.specializationDesc).toContain('sword-and-shield');
      expect(component.subclassTerm).toBe('oath');
      expect(component.spells).toEqual([]);
    });

    it('recommends a fighting style and an oath per specialization (informational)', () => {
      component.pc = makePaladin();
      expect(component.recommendedFightingStyleText).toBe('Interception or Protection');
      expect(component.guidance?.subclass.name).toBe('Oath of Devotion');
      expect(component.subclassMatch).toBe('pending');
      component.pc = makePaladin({ specialization: 'Holy' });
      expect(component.recommendedFightingStyleText).toBe('Blessed Warrior — with Sacred Flame and Spare the Dying');
      component.pc = makePaladin({ specialization: 'Retribution', subclass: 'Oath of Vengeance', level: 3 });
      expect(component.recommendedFightingStyleText).toBe('Great Weapon Fighting');
      expect(component.subclassMatch).toBe('match');
      component.pc = makePaladin({ specialization: 'Retribution', subclass: 'Oath of Glory', level: 3 });
      expect(component.subclassMatch).toBe('different');
    });

    it('lists the suggested spells per specialization and marks known / prepared ones', () => {
      component.pc = makePaladin();
      expect(component.suggestedSpells.map(r => r.level)).toEqual([1, 2, 3, 4, 5]);
      expect(component.suggestedSpells[0].spells).toEqual([
        { name: 'Heroism', known: true, prepared: false },
        { name: 'Shield of Faith', known: true, prepared: true },
      ]);
      expect(component.suggestedSpells[2].spells.map(s => s.name)).toEqual(["Crusader's Mantle", 'Guided Prayer']);
      component.pc = makePaladin({ specialization: 'Holy' });
      expect(component.suggestedSpells[3].spells.map(s => s.name)).toEqual(['Aura of Purity', 'Divine Shield']);
      component.pc = makePaladin({ specialization: 'Retribution' });
      expect(component.suggestedSpells.map(r => r.spells.map(s => s.name))).toEqual([
        ['Divine Favor', 'Thunderous Smite'], ['Consecration', 'Shining Smite'],
        ["Crusader's Mantle", 'Elemental Weapon'], ['Staggering Smite'], ['Destructive Wave'],
      ]);
    });

    it('renders the paladin recommendations without druid wording or beast forms', () => {
      dndResources.getSpells.and.returnValue(of([
        { ...deathGrip, name: 'Divine Shield', classes: ['paladin'] } as DndSpell,
      ]));
      const fixture = TestBed.createComponent(HeroClassPanelComponent);
      fixture.componentRef.setInput('pc', makePaladin({ specialization: 'Holy' }));
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const text = el.textContent ?? '';
      expect(text).toContain('World of Warcraft Paladin');
      expect(text).toContain('Recommended fighting style');
      expect(text).toContain('Recommended oath');
      expect(text).toContain('You choose your oath at Paladin level 3.');
      expect(text).toContain('Suggested Holy Spells');
      expect(text).not.toContain('Suggestions only');
      expect(text).not.toContain('Beast Forms');
      expect(text).not.toContain('druid');
      const marked = Array.from(el.querySelectorAll('.suggested-spell'))
        .filter(n => n.querySelector('.wow-mark')).map(n => n.textContent!.replace('✦', '').trim());
      expect(marked).toEqual(['Divine Shield']);
    });
    describe('Oath of the Holy', () => {
      const holy = (level: number, overrides: Partial<PC> = {}) =>
        makePaladin({ specialization: 'Holy', subclass: 'Oath of the Holy', level, ...overrides });
      const names = (level: number) => {
        component.pc = holy(level);
        return component.subclassSpells.map(s => s.name);
      };

      it('lists the always-prepared oath spells by Paladin level', () => {
        expect(names(2)).toEqual([]);
        expect(names(3)).toEqual(['Cure Wounds', 'Healing Word']);
        expect(names(5)).toEqual(['Cure Wounds', 'Healing Word', 'Lesser Restoration', 'Prayer of Healing']);
        expect(names(9)).toEqual([
          'Cure Wounds', 'Healing Word', 'Lesser Restoration', 'Prayer of Healing', 'Dispel Magic', 'Mass Healing Word',
        ]);
        expect(names(13).slice(-2)).toEqual(['Aura of Life', 'Death Ward']);
        expect(names(13).length).toBe(8);
        expect(names(17).slice(-2)).toEqual(['Greater Restoration', 'Mass Cure Wounds']);
        expect(names(20).length).toBe(10);
      });

      it('shows the oath list in its own section, with no hero table for a variant', () => {
        component.pc = holy(5);
        expect(component.spells).toEqual([]);
        expect(component.spellSections.map(sec => sec.title)).toEqual(['Oath of the Holy Spells']);
        expect(component.spellSections[0].entries.map(e => e.classLevel)).toEqual([3, 3, 5, 5]);
        component.pc = holy(2, { subclass: undefined });
        expect(component.spellSections).toEqual([]);
        // Another oath has no list here.
        component.pc = holy(9, { subclass: 'Oath of Devotion' });
        expect(component.spellSections).toEqual([]);
      });

      it('recognizes any paladin with the oath, even without a specialization', () => {
        expect(isHeroClass(holy(3, { specialization: null }))).toBeTrue();
        component.pc = holy(3, { specialization: null });
        expect(component.subclassSpells.map(s => s.name)).toEqual(['Cure Wounds', 'Healing Word']);
        expect(component.guidance).toBeNull();
      });

      it('renders the list with descriptions looked up by name', () => {
        dndResources.getSpells.and.returnValue(of([
          { ...deathGrip, name: 'Healing Word', level: 1, school: 'abjuration', description: 'A word of healing.', source: undefined } as DndSpell,
        ]));
        const fixture = TestBed.createComponent(HeroClassPanelComponent);
        fixture.componentRef.setInput('pc', holy(3));
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.hero-spells-title')?.textContent).toContain('Oath of the Holy Spells');
        expect(el.textContent).toContain('Always prepared');
        const items = Array.from(el.querySelectorAll('.hero-spell'));
        expect(items.map(i => i.querySelector('.hero-spell-name')?.textContent)).toEqual(['Cure Wounds', 'Healing Word']);
        expect(items[1].querySelector('.hero-spell-meta')?.textContent).toContain('Paladin 3');
        expect(items[1].querySelector('.hero-spell-meta')?.textContent).toContain('Level 1 abjuration');
        expect(items[1].querySelector('.hero-spell-desc')?.textContent).toContain('A word of healing.');
        expect(items[0].querySelector('.hero-spell-desc')?.textContent).toContain('No description available.');
      });
    });
  });

  describe('World of Warcraft Rogue', () => {
    function makeRogue(overrides: Partial<PC> = {}): PC {
      return {
        id: 10, name: 'Vex', clazz: 'Rogue', subclass: undefined, specialization: 'Outlaw',
        level: 2, prof: 2, playerName: 'Jack', stats: { STR: 10, DEX: 18, CON: 14, INT: 12, WIS: 10, CHA: 16 },
        ...overrides,
      };
    }

    function render(pc: PC): HTMLElement {
      const fixture = TestBed.createComponent(HeroClassPanelComponent);
      fixture.componentRef.setInput('pc', pc);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('renders for a WoW rogue but not for a base rogue', () => {
      expect(isHeroClass(makeRogue())).toBeTrue();
      expect(isHeroClass(makeRogue({ specialization: null, subclass: 'Thief' }))).toBeFalse();
      expect(isHeroClass(makeRogue({ specialization: null, subclass: 'Swashbuckler' }))).toBeTrue();
    });

    it('titles the panel and shows the spec, with no spells to load', () => {
      component.pc = makeRogue({ level: 9, subclass: 'Swashbuckler' });
      expect(component.panelTitle).toBe('World of Warcraft Rogue');
      expect(component.specializationTitle).toBe('Outlaw');
      expect(component.specializationDesc).toContain('swashbuckler');
      expect(component.subclassTerm).toBe('subclass');
      expect(component.spellSections).toEqual([]);
      expect(component.suggestedSpells).toEqual([]);
      expect(component.recommendedFightingStyleText).toBe('');
      expect(dndResources.getSpells).not.toHaveBeenCalled();
    });

    it('recommends a subclass per specialization (informational)', () => {
      component.pc = makeRogue();
      expect(component.guidance?.subclass.name).toBe('Swashbuckler');
      expect(component.subclassMatch).toBe('pending');
      component.pc = makeRogue({ level: 3, subclass: 'Swashbuckler' });
      expect(component.subclassMatch).toBe('match');
      component.pc = makeRogue({ specialization: 'Assassination', level: 3, subclass: 'Assassin' });
      expect(component.subclassMatch).toBe('match');
      component.pc = makeRogue({ specialization: 'Subtlety', level: 3, subclass: 'Thief' });
      expect(component.guidance?.subclass.name).toBe('Soulknife');
      expect(component.subclassMatch).toBe('different');
    });

    it('renders the subclass recommendation with no spell or fighting-style headings', () => {
      const el = render(makeRogue({ level: 9, subclass: 'Swashbuckler' }));
      const text = el.textContent ?? '';
      expect(text).toContain('World of Warcraft Rogue');
      expect(text).toContain('Recommended subclass');
      expect(text).toContain('Your subclass matches the Outlaw recommendation.');
      expect(text).not.toContain('Recommended fighting style');
      expect(text).not.toContain('Spells');
      expect(text).not.toContain('Beast Forms');
      expect(el.querySelector('.hero-spells-title')).toBeNull();
      expect(el.querySelector('.hero-level-tip')).toBeNull();
    });

    it('shows the Assassination level-5 tip as a Rogue 5 entry', () => {
      const el = render(makeRogue({ specialization: 'Assassination', level: 2 }));
      const tip = el.querySelector('.hero-level-tip') as HTMLElement;
      expect(tip.querySelector('.feature-source')?.textContent).toContain('Rogue 5');
      expect(tip.querySelector('.feature-desc')?.textContent).toContain('Poison');
      expect(el.textContent).toContain('You choose your subclass at Rogue level 3.');
    });
  });

  describe('World of Warcraft Shaman (Barbarian)', () => {
    const daylight = {
      name: 'Daylight', level: 3, school: 'evocation', classes: ['cleric'], actionType: 'action',
      concentration: false, ritual: false, range: '60 feet', components: ['v', 's'], duration: '1 hour',
      description: 'A 60-foot-radius sphere of light spreads out.',
    } as DndSpell;

    function makeShaman(overrides: Partial<PC> = {}): PC {
      return {
        id: 11, name: 'Durak', clazz: 'Barbarian', subclass: undefined, specialization: 'Elemental',
        level: 2, playerName: 'Kara', stats: { STR: 16, DEX: 14, CON: 16, INT: 8, WIS: 14, CHA: 10 },
        ...overrides,
      };
    }

    function render(pc: PC): HTMLElement {
      const fixture = TestBed.createComponent(HeroClassPanelComponent);
      fixture.componentRef.setInput('pc', pc);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    beforeEach(() => dndResources.getSpells.and.returnValue(of([daylight])));

    it('renders for a WoW barbarian but not for a base barbarian', () => {
      expect(isHeroClass(makeShaman())).toBeTrue();
      expect(isHeroClass(makeShaman({ specialization: null, subclass: 'Path of the Berserker' }))).toBeFalse();
      expect(isHeroClass(makeShaman({ specialization: null, subclass: 'Path of the Elements' }))).toBeTrue();
    });

    it('titles the panel, shows the spec and the Earthen Ring reminder, and has no cards before level 3', () => {
      component.pc = makeShaman();
      expect(component.panelTitle).toBe('World of Warcraft Shaman');
      expect(component.specializationTitle).toBe('Elemental');
      expect(component.specializationDesc).toContain('lightning, fire, and frost');
      expect(component.subclassTerm).toBe('path');
      expect(component.guidance?.subclass.name).toBe('Path of the Elements');
      expect(component.subclassMatch).toBe('pending');
      expect(component.featureCards).toEqual([]);
      expect(dndResources.getSpells).not.toHaveBeenCalled();
      const el = render(makeShaman());
      expect(el.querySelector('.hero-note')?.textContent).toContain('Earthen Ring by 3');
      expect(el.textContent).toContain('You choose your path at Barbarian level 3.');
      expect(el.querySelector('.feature-card')).toBeNull();
    });

    it('shows only the Totems card for a WoW barbarian on a PHB path', () => {
      component.pc = makeShaman({ specialization: 'Restoration', level: 3, subclass: 'Path of the World Tree' });
      expect(component.featureCards.map(c => c.name)).toEqual(['Totems']);
      expect(component.subclassMatch).toBe('match');
      expect(dndResources.getSpells).not.toHaveBeenCalled();
    });

    it('never shows the Totems card for a base barbarian', () => {
      component.pc = makeShaman({ specialization: null, subclass: 'Path of the Zealot', level: 10 });
      expect(component.hero).toBeUndefined();
      expect(component.featureCards).toEqual([]);
    });

    it('renders the Totems and Raging Elements cards with computed numbers', () => {
      const el = render(makeShaman({ level: 3, subclass: 'Path of the Elements', prof: 2 }));
      const cards = Array.from(el.querySelectorAll('.feature-card')) as HTMLElement[];
      expect(cards.map(c => c.querySelector('.form-card-name')?.textContent?.trim())).toEqual(['Totems', 'Raging Elements']);
      expect(el.textContent).toContain('Shaman Features');
      expect(cards[0].textContent).toContain('Earthbind');
      expect(cards[0].textContent).toContain('Wind Rush');
      const raging = cards[1];
      expect(raging.textContent).toContain('Save DC13');
      expect(raging.textContent).toContain('Spell attack+5');
      expect(raging.textContent).toContain('(2d8 Cold)');
      expect(raging.textContent).not.toContain('Echo of the Elements');
      expect(raging.querySelector('.hero-spells')).toBeNull();
    });

    it('lists the Echo of the Elements spells from the spell data from level 6', () => {
      component.pc = makeShaman({ level: 6, subclass: 'Path of the Elements' });
      expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
      const el = render(makeShaman({ level: 10, subclass: 'Path of the Elements' }));
      const names = Array.from(el.querySelectorAll('.feature-card .hero-spell-name')).map(n => n.textContent!.trim());
      expect(names).toEqual(['Elementalism', 'Daylight', 'Water Walk', 'Wind Wall']);
      expect(el.textContent).toContain('A 60-foot-radius sphere of light');
      expect(el.textContent).toContain('Level 3 evocation');
      expect(el.textContent).toContain('Primordial Bond');
    });

    it('renders the Spiritual Guardian card with Spirit Shield and Consult the Spirits spells', () => {
      const el = render(makeShaman({ specialization: 'Enhancement', level: 10, subclass: 'Path of the Spiritual Guardian' }));
      const card = (Array.from(el.querySelectorAll('.feature-card')) as HTMLElement[])
        .find(c => c.textContent!.includes('Spiritual Guardian'))!;
      expect(card.textContent).toContain('Spirit Shield');
      expect(card.textContent).toContain('3d6');
      expect(Array.from(card.querySelectorAll('.hero-spell-name')).map(n => n.textContent!.trim()))
        .toEqual(['Augury', 'Clairvoyance']);
      expect(card.textContent).not.toContain("Spirits' Fury");
    });
  });

  describe('World of Warcraft Warlock', () => {
    const wowStub = (name: string, level: number) => ({
      ...deathGrip, name, level, classes: ['warlock'], concentration: true,
    } as DndSpell);
    const baseSpell = (name: string, level: number) => ({
      ...deathGrip, name, level, classes: ['warlock'], source: undefined, description: `${name} text.`,
    } as DndSpell);

    function makeWarlock(overrides: Partial<PC> = {}): PC {
      return {
        id: 12, name: 'Nixa', clazz: 'Warlock', subclass: 'Fiend Patron', specialization: 'Demonology',
        level: 5, playerName: 'Mira', stats: { STR: 8, DEX: 14, CON: 14, INT: 12, WIS: 10, CHA: 18 },
        spells: [
          { lvl: 0, name: 'Eldritch Blast', school: 'Evocation', time: '1 action', prepared: true },
          { lvl: 1, name: 'Hellish Rebuke', school: 'Evocation', time: '1 reaction', prepared: true },
          { lvl: 2, name: 'Suggestion', school: 'Enchantment', time: '1 action', prepared: false },
        ],
        ...overrides,
      };
    }

    function render(pc: PC): HTMLElement {
      const fixture = TestBed.createComponent(HeroClassPanelComponent);
      fixture.componentRef.setInput('pc', pc);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    beforeEach(() => dndResources.getSpells.and.returnValue(of([
      wowStub("Hand of Gul'dan", 3), wowStub('Rain of Fire', 3), baseSpell('Suggestion', 2), baseSpell('Fear', 3),
    ])));

    it('renders for a WoW warlock but not for a base warlock', () => {
      expect(isHeroClass(makeWarlock())).toBeTrue();
      expect(isHeroClass(makeWarlock({ subclass: 'Archfey Patron' }))).toBeTrue();
      expect(isHeroClass(makeWarlock({ specialization: null }))).toBeFalse();
    });

    it('titles the panel and shows the spec, with no level-1 feature, resource or always-prepared list', () => {
      component.pc = makeWarlock();
      expect(component.panelTitle).toBe('World of Warcraft Warlock');
      expect(component.specializationTitle).toBe('Demonology');
      expect(component.specializationDesc).toContain('demons');
      expect(component.hero?.level1Feature).toBeUndefined();
      expect(component.resource).toBeNull();
      expect(component.spellSections).toEqual([]);
    });

    it('recommends a patron per specialization, chosen at Warlock level 1 (informational)', () => {
      component.pc = makeWarlock();
      expect(component.subclassLevel).toBe(1);
      expect(component.subclassTerm).toBe('patron');
      expect(component.guidance?.subclass.name).toBe('Fiend Patron');
      expect(component.subclassMatch).toBe('match');
      component.pc = makeWarlock({ specialization: 'Affliction' });
      expect(component.guidance?.subclass.name).toBe('Great Old One Patron');
      expect(component.subclassMatch).toBe('different');
      component.pc = makeWarlock({ specialization: 'Destruction', subclass: undefined });
      expect(component.subclassMatch).toBe('pending');

      const el = render(makeWarlock({ subclass: undefined }));
      const patron = (Array.from(el.querySelectorAll('.feature')) as HTMLElement[])
        .find(f => f.textContent!.includes('Recommended patron'))!;
      expect(patron.querySelector('.feature-source')!.textContent!.trim()).toBe('Warlock 1');
      expect(patron.textContent).toContain('Fiend Patron');
      expect(patron.textContent).toContain('You choose your patron at Warlock level 1.');
      expect(el.textContent).not.toContain('Warlock 3');
    });

    it('lists the recommended invocations per spec and marks the WoW ones with a TBD title', () => {
      component.pc = makeWarlock();
      expect(component.invocationRows.map(r => r.names.length)).toEqual([1, 2, 6]);
      expect(component.isWowInvocation('Health Funnel')).toBeTrue();
      expect(component.isWowInvocation('Repelling Blast')).toBeFalse();

      const el = render(makeWarlock());
      const block = el.querySelector('.hero-invocations') as HTMLElement;
      expect(block.textContent).toContain('Recommended invocations');
      const marked = (Array.from(block.querySelectorAll('.invocation')) as HTMLElement[])
        .filter(i => i.querySelector('.wow-mark')).map(i => i.textContent!.replace('✦', '').trim());
      expect(marked).toEqual(['Pact of the Legion', 'Health Funnel', 'Call of the Void', 'Expendable Minions',
        'Legion Summoning', 'Master Demonologist']);
      expect(block.querySelector('.wow-mark')!.getAttribute('title'))
        .toBe('Full text TBD — World of Warcraft invocations update.');
      expect(block.textContent).toContain("aren't tracked here");

      const aff = render(makeWarlock({ specialization: 'Affliction' })).querySelector('.hero-invocations')!;
      expect(aff.textContent).toContain('Curse of Corruption');
      expect(aff.textContent).toContain('Eldritch Mind');
      expect(aff.textContent).not.toContain('Health Funnel');
    });

    it('lists the suggested spells per spec and marks known / prepared ones', () => {
      component.pc = makeWarlock();
      expect(component.suggestedSpells.map(r => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(component.suggestedSpells.map(r => r.spells[0].name)).toEqual([
        'Hellish Rebuke', 'Suggestion', "Hand of Gul'dan", 'Summon Aberration', 'Planar Binding', 'Summon Fiend',
        'Plane Shift', 'Dominate Monster', 'Gate',
      ]);
      expect(component.suggestedSpells[0].spells[0]).toEqual({ name: 'Hellish Rebuke', known: true, prepared: true });
      expect(component.suggestedSpells[1].spells[0]).toEqual({ name: 'Suggestion', known: true, prepared: false });
      component.pc = makeWarlock({ specialization: 'Affliction' });
      expect(component.suggestedSpells.map(r => r.spells[0].name)).toEqual([
        'Bane', 'Ray of Enfeeblement', 'Fear', 'Blight', 'Synaptic Static', 'Eyebite', 'Finger of Death',
        'Befuddlement', 'Weird',
      ]);
      component.pc = makeWarlock({ specialization: 'Destruction' });
      expect(component.suggestedSpells.map(r => r.spells[0].name)).toEqual([
        'Arms of Hadar', 'Cloud of Daggers', 'Rain of Fire', 'Blight', "Jallarzi's Storm of Radiance",
        'Circle of Death', 'Finger of Death', 'Power Word Stun', 'Power Word Kill',
      ]);
    });

    it('marks Hand of Gul\'dan and Rain of Fire as WoW spells and shows the Summon Fiend note', () => {
      const el = render(makeWarlock());
      expect(el.textContent).toContain('Suggested Demonology Spells');
      const marked = (Array.from(el.querySelectorAll('.suggested-spell')) as HTMLElement[])
        .filter(s => s.querySelector('.wow-mark')).map(s => s.textContent!.replace('✦', '').trim());
      expect(marked).toEqual(["Hand of Gul'dan"]);
      expect(el.querySelector('.hero-spells-flavor')?.textContent).toContain('Summon Fiend');
      expect(el.querySelector('.hero-spells-flavor')?.textContent).toContain('vilefiend');

      const dest = render(makeWarlock({ specialization: 'Destruction' }));
      expect((Array.from(dest.querySelectorAll('.suggested-spell')) as HTMLElement[])
        .filter(s => s.querySelector('.wow-mark')).map(s => s.textContent!.replace('✦', '').trim()))
        .toEqual(['Rain of Fire']);
      expect(dest.querySelector('.hero-spells-flavor')?.textContent).toContain('demonic tyrant');
    });

    it('keeps the other variants on their level-3 wording, with no invocations or flavour note', () => {
      const druid = render({
        id: 8, name: 'Hrogar', clazz: 'Druid', subclass: undefined, specialization: 'Guardian', level: 2, playerName: 'Hank',
      } as PC);
      expect(druid.textContent).toContain('Druid 3');
      expect(druid.textContent).toContain('You choose your circle at Druid level 3.');
      expect(druid.querySelector('.hero-invocations')).toBeNull();
      expect(druid.querySelector('.hero-spells-flavor')).toBeNull();
    });
  });

  describe('World of Warcraft Warrior (Fighter)', () => {
    function makeWarrior(overrides: Partial<PC> = {}): PC {
      return {
        id: 13, name: 'Garrosh', clazz: 'Fighter', subclass: undefined, specialization: 'Arms',
        level: 2, prof: 2, playerName: 'Lee', stats: { STR: 17, DEX: 12, CON: 15, INT: 8, WIS: 12, CHA: 10 },
        ...overrides,
      };
    }

    function render(pc: PC): HTMLElement {
      const fixture = TestBed.createComponent(HeroClassPanelComponent);
      fixture.componentRef.setInput('pc', pc);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('renders for a WoW fighter but not for a base fighter', () => {
      expect(isHeroClass(makeWarrior())).toBeTrue();
      expect(isHeroClass(makeWarrior({ specialization: null, subclass: 'Battle Master' }))).toBeFalse();
    });

    it('titles the panel and shows the spec, with no spells to load', () => {
      component.pc = makeWarrior();
      expect(component.panelTitle).toBe('World of Warcraft Warrior');
      expect(component.specializationTitle).toBe('Arms');
      expect(component.specializationDesc).toContain('two-handed');
      expect(component.subclassTerm).toBe('subclass');
      expect(component.spells).toEqual([]);
      expect(component.suggestedSpells).toEqual([]);
      expect(dndResources.getSpells).not.toHaveBeenCalled();
    });

    it('recommends a level-1 fighting style and a subclass per specialization (informational)', () => {
      component.pc = makeWarrior();
      expect(component.recommendedFightingStyleText).toBe('Great Weapon Fighting');
      expect(component.fightingStyleLevel).toBe(1);
      expect(component.guidance?.subclass.name).toBe('Battle Master');
      expect(component.subclassMatch).toBe('pending');
      component.pc = makeWarrior({ specialization: 'Fury', subclass: 'Champion', level: 3 });
      expect(component.recommendedFightingStyleText).toBe('Two-Weapon Fighting');
      expect(component.subclassMatch).toBe('match');
      component.pc = makeWarrior({ specialization: 'Protection', subclass: 'Eldritch Knight', level: 3 });
      expect(component.recommendedFightingStyleText).toBe('Interception or Protection');
      expect(component.subclassMatch).toBe('different');
    });

    it('renders the fighting style as Fighter 1 and the maneuvers with ✦ on the WoW ones', () => {
      const el = render(makeWarrior({ specialization: 'Protection' }));
      const text = el.textContent ?? '';
      expect(text).toContain('Recommended fighting style');
      expect(text).toContain('Fighter 1');
      expect(text).not.toContain('Fighter 2');
      expect(text).toContain('You choose your subclass at Fighter level 3.');
      const box = el.querySelector('.hero-maneuvers') as HTMLElement;
      expect(box.textContent).toContain('Maneuvers to consider');
      expect(box.textContent).toContain('Battle Master 3');
      const maneuvers = Array.from(box.querySelectorAll('.maneuver')) as HTMLElement[];
      expect(maneuvers.filter(m => m.querySelector('.wow-mark')).map(m => m.textContent!.replace('✦', '').trim()))
        .toEqual(['Battle Shout', 'Demoralizing Shout', 'Warding Maneuver']);
      expect(maneuvers.length).toBe(7);
      expect(box.textContent).toContain("Maneuvers aren't tracked here");
      expect(box.textContent).not.toContain('Suggestions only');
      expect(text).not.toContain('Suggested');
      expect(text).not.toContain('Beast Forms');
    });

    it('shows no maneuvers for Fury, and keeps the paladin fighting style at Paladin 2', () => {
      const fury = render(makeWarrior({ specialization: 'Fury' }));
      expect(fury.querySelector('.hero-maneuvers')).toBeNull();
      expect(fury.textContent).toContain('Two-Weapon Fighting');
      const paladin = render({
        id: 9, name: 'Aelira', clazz: 'Paladin', subclass: undefined, specialization: 'Protection', level: 2,
        playerName: 'Ivy',
      } as PC);
      expect(paladin.textContent).toContain('Paladin 2');
      expect(paladin.querySelector('.hero-maneuvers')).toBeNull();
    });

    describe('Battle Master card', () => {
      it('shows only for a WoW warrior Battle Master from Fighter level 3', () => {
        component.pc = makeWarrior({ specialization: 'Protection', subclass: 'Battle Master', level: 3 });
        expect(component.featureCards.map(c => c.name)).toEqual(['Battle Master']);
        component.pc = makeWarrior({ specialization: 'Protection', subclass: 'Battle Master', level: 2 });
        expect(component.featureCards).toEqual([]);
        component.pc = makeWarrior({ specialization: 'Fury', subclass: 'Champion', level: 7 });
        expect(component.featureCards).toEqual([]);
        // A Fury warrior who picks Battle Master anyway still gets the card.
        component.pc = makeWarrior({ specialization: 'Fury', subclass: 'Battle Master', level: 7 });
        expect(component.featureCards.map(c => c.name)).toEqual(['Battle Master']);
        // A base-game Battle Master (no specialization) is not a WoW warrior: no card.
        component.pc = makeWarrior({ specialization: null, subclass: 'Battle Master', level: 10 });
        expect(component.hero).toBeUndefined();
        expect(component.featureCards).toEqual([]);
        expect(dndResources.getSpells).not.toHaveBeenCalled();
      });

      it('renders the dice, DC and the WoW maneuvers with the die size, plus the untracked note', () => {
        const el = render(makeWarrior({ specialization: 'Protection', subclass: 'Battle Master', level: 7, prof: 3 }));
        expect(el.textContent).toContain('Warrior Features');
        const card = el.querySelector('.feature-card') as HTMLElement;
        expect(card.querySelector('.form-card-name')?.textContent?.trim()).toBe('Battle Master');
        expect(card.querySelector('.form-card-size')?.textContent?.trim()).toBe('Battle Master 3');
        expect(card.textContent).toContain('Superiority Dice5');
        expect(card.textContent).toContain('Died8');
        expect(card.textContent).toContain('Maneuver DC14');
        expect(card.textContent).toContain('Short or Long Rest');
        expect(card.querySelector('.feature-card-rows-title')?.textContent).toBe('World of Warcraft maneuvers');
        const rows = Array.from(card.querySelectorAll('.feature-card-row')).map(r => r.textContent!.trim());
        expect(rows.map(r => r.split(' ')[0])).toEqual(['Battle', 'Demoralizing', 'Heroic', 'Mortal', 'Warding']);
        expect(rows.every(r => r.includes('(d8)'))).toBeTrue();
        expect(card.querySelector('.feature-card-note')?.textContent).toContain("Maneuvers aren't tracked by the app");
      });

      it('grows the die at level 10 and 18', () => {
        const at10 = render(makeWarrior({ specialization: 'Arms', subclass: 'Battle Master', level: 10 }));
        expect(at10.querySelector('.feature-card')!.textContent).toContain('(d10)');
        const at18 = render(makeWarrior({ specialization: 'Arms', subclass: 'Battle Master', level: 18 }));
        expect(at18.querySelector('.feature-card')!.textContent).toContain('Superiority Dice6');
        expect(at18.querySelector('.feature-card')!.textContent).toContain('(d12)');
      });
    });
  });

  describe('World of Warcraft Priest (Cleric)', () => {
    function makePriest(overrides: Partial<PC> = {}): PC {
      return {
        id: 14, name: 'Elara', clazz: 'Cleric', subclass: undefined, specialization: 'Shadow',
        level: 2, prof: 2, playerName: 'Ana', stats: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 17, CHA: 12 },
        spells: [
          { lvl: 2, name: 'Blur', school: 'Illusion', time: '1 action', prepared: true },
          { lvl: 2, name: 'Silence', school: 'Illusion', time: '1 action', prepared: false },
        ],
        ...overrides,
      };
    }

    function render(pc: PC): HTMLElement {
      const fixture = TestBed.createComponent(HeroClassPanelComponent);
      fixture.componentRef.setInput('pc', pc);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('renders for a WoW cleric but not for a base cleric', () => {
      expect(isHeroClass(makePriest())).toBeTrue();
      expect(isHeroClass(makePriest({ specialization: null, subclass: 'Life Domain' }))).toBeFalse();
      expect(isHeroClass(makePriest({ specialization: null, subclass: 'Shadow Domain' }))).toBeTrue();
    });

    it('titles the panel and recommends a domain per specialization (informational)', () => {
      component.pc = makePriest();
      expect(component.panelTitle).toBe('World of Warcraft Priest');
      expect(component.specializationTitle).toBe('Shadow');
      expect(component.specializationDesc).toContain('Void');
      expect(component.subclassTerm).toBe('domain');
      expect(component.guidance?.subclass.name).toBe('Shadow Domain');
      expect(component.subclassMatch).toBe('pending');
      component.pc = makePriest({ specialization: 'Holy', subclass: 'Life Domain', level: 3 });
      expect(component.subclassMatch).toBe('match');
      component.pc = makePriest({ specialization: 'Discipline', subclass: 'War Domain', level: 3 });
      expect(component.subclassMatch).toBe('different');
    });

    it('lists the suggested spells per specialization and marks known / prepared ones', () => {
      component.pc = makePriest();
      expect(component.suggestedSpells.map(r => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(component.suggestedSpells[1].spells).toEqual([
        { name: 'Blindness/Deafness', known: false, prepared: false },
        { name: 'Blur', known: true, prepared: true },
        { name: 'Hold Person', known: false, prepared: false },
        { name: 'Silence', known: true, prepared: false },
      ]);
      component.pc = makePriest({ specialization: 'Discipline' });
      expect(component.suggestedSpells[1].spells.map(s => s.name)).toEqual(['Aid', 'Blur', 'Levitate', 'Spiritual Weapon']);
      component.pc = makePriest({ specialization: 'Holy' });
      expect(component.suggestedSpells[8].spells.map(s => s.name)).toEqual(['Apotheosis', 'Mass Heal']);
    });

    it('marks the WoW spells and the added-list spells (Blur, Levitate) with ✦', () => {
      dndResources.getSpells.and.returnValue(of([
        { ...deathGrip, name: 'Shadow Word: Pain', classes: ['cleric'] } as DndSpell,
        { ...deathGrip, name: 'Holy Nova', level: 4, classes: ['cleric'] } as DndSpell,
        { ...deathGrip, name: 'Blur', level: 2, classes: ['sorcerer', 'wizard'], source: undefined } as DndSpell,
        { ...deathGrip, name: 'Aid', level: 2, classes: ['cleric'], source: undefined } as DndSpell,
      ]));
      const el = render(makePriest({ specialization: 'Discipline', spells: [] }));
      const text = el.textContent ?? '';
      expect(text).toContain('World of Warcraft Priest');
      expect(text).toContain('Recommended domain');
      expect(text).toContain('You choose your domain at Cleric level 3.');
      expect(text).toContain('Suggested Discipline Spells');
      expect(text).not.toContain('Suggestions only');
      expect(text).not.toContain('Beast Forms');
      const marks = Array.from(el.querySelectorAll('.suggested-spell'))
        .filter(n => n.querySelector('.wow-mark'))
        .map(n => [n.textContent!.replace('✦', '').trim(), n.querySelector('.wow-mark')!.getAttribute('title')]);
      expect(marks).toEqual([
        ['Shadow Word: Pain', 'World of Warcraft spell'],
        ['Blur', 'Added to the Cleric spell list by the World of Warcraft Priest'],
        ['Levitate', 'Added to the Cleric spell list by the World of Warcraft Priest'],
        ['Holy Nova', 'World of Warcraft spell'],
      ]);
    });

    it('shows the always-prepared domain spells by Cleric level in their own section', () => {
      component.pc = makePriest({ subclass: 'Shadow Domain', level: 5 });
      expect(component.spells).toEqual([]);
      expect(component.spellSections.map(sec => sec.title)).toEqual(['Shadow Domain Spells']);
      expect(component.spellSections[0].entries.map(e => e.name)).toEqual([
        'Crown of Madness', 'Dissonant Whispers', 'Mind Spike', 'Shadow Word: Pain', 'Summon Undead', 'Vampiric Touch',
      ]);
      component.pc = makePriest({ specialization: 'Discipline', subclass: 'Discipline Domain', level: 9 });
      expect(component.spellSections[0].title).toBe('Discipline Domain Spells');
      expect(component.spellSections[0].entries.length).toBe(10);
      // The Life Domain's spells come from the server's features, not a panel table.
      component.pc = makePriest({ specialization: 'Holy', subclass: 'Life Domain', level: 9 });
      expect(component.spellSections).toEqual([]);
    });

    it('shows the Shadow Domain card from Cleric 3, and no card before it or for the Life Domain', () => {
      component.pc = makePriest({ level: 2 });
      expect(component.featureCards).toEqual([]);
      component.pc = makePriest({ specialization: 'Holy', subclass: 'Life Domain', level: 6 });
      expect(component.featureCards).toEqual([]);
      const el = render(makePriest({ subclass: 'Shadow Domain', level: 6 }));   // WIS 17 → +3
      expect(el.textContent).toContain('Priest Features');
      const card = el.querySelector('.feature-card') as HTMLElement;
      expect(card.getAttribute('aria-label')).toBe('Shadow Domain');
      expect(Array.from(card.querySelectorAll('.feature-card-row strong')).map(n => n.textContent))
        .toEqual(['Shadowform', 'Devouring Plague', 'Dispersion']);
      expect(card.textContent).toContain('3 / Long Rest');
      expect(card.textContent).toContain('up to 3 Hit Dice');
    });

    it('shows the Discipline Domain card with the computed spell attack and Luminous Barrier', () => {
      component.pc = makePriest({ specialization: 'Discipline', subclass: 'Discipline Domain', level: 6, prof: 3 });
      expect(component.featureCards.map(c => c.name)).toEqual(['Discipline Domain']);
      expect(component.featureCards[0].stats).toEqual([
        { label: 'Spell attack', value: '+6' }, { label: 'Barrier', value: '9 Temp HP' },
      ]);
    });

    it("describes Evard's Black Tentacles from its SRD entry at Cleric 7 (Shadow Domain)", () => {
      dndResources.getSpells.and.returnValue(of([
        { ...deathGrip, name: 'Black Tentacles', level: 4, school: 'conjuration', description: 'Tentacle text.' } as DndSpell,
      ]));
      const el = render(makePriest({ subclass: 'Shadow Domain', level: 7 }));
      const row = Array.from(el.querySelectorAll('.hero-spell'))
        .find(n => n.querySelector('.hero-spell-name')!.textContent!.includes("Evard's Black Tentacles"))!;
      expect(row.querySelector('.hero-spell-meta')!.textContent).toContain('Cleric 7');
      expect(row.querySelector('.hero-spell-meta')!.textContent).toContain('Level 4 conjuration');
      expect(row.querySelector('.hero-spell-desc')!.textContent).toContain('Tentacle text.');
    });
  });
});

describe('HeroClassPanelComponent — World of Warcraft Evoker (Sorcerer)', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let component: HeroClassPanelComponent;

  const stub = (name: string, level: number, wow = true) => ({
    name, level, school: 'evocation', classes: ['sorcerer'], actionType: 'action', concentration: false, ritual: false,
    range: 'TBD', components: ['v', 's'], duration: 'TBD', description: `${name} text.`,
    ...(wow ? { source: 'World of Warcraft' } : {}),
  }) as DndSpell;

  function makeEvoker(overrides: Partial<PC> = {}): PC {
    return {
      id: 15, name: 'Kazrethos', clazz: 'Sorcerer', subclass: 'Draconic Sorcery', specialization: 'Devastation',
      level: 5, playerName: 'Omar', stats: { STR: 10, DEX: 14, CON: 14, INT: 12, WIS: 10, CHA: 18 },
      spells: [{ lvl: 1, name: 'Ice Knife', school: 'Conjuration', time: '1 action', prepared: true }],
      ...overrides,
    };
  }

  function render(pc: PC): HTMLElement {
    const fixture = TestBed.createComponent(HeroClassPanelComponent);
    fixture.componentRef.setInput('pc', pc);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of([
      stub('Azure Strike', 1), stub('Living Flame', 1), stub('Chromatic Orb', 1, false), stub('Fireball', 3, false),
    ]));
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
    component = TestBed.runInInjectionContext(() => new HeroClassPanelComponent());
  });

  it('renders only for a Draconic Sorcery sorcerer with an Evoker specialization', () => {
    expect(isHeroClass(makeEvoker())).toBeTrue();
    expect(isHeroClass(makeEvoker({ specialization: null }))).toBeFalse();
    expect(isHeroClass(makeEvoker({ subclass: 'Wild Magic Sorcery' }))).toBeFalse();
    expect(isHeroClass(makeEvoker({ specialization: 'Frost' }))).toBeFalse();
  });

  it('titles the panel "World of Warcraft Evoker", not the base-game subclass', () => {
    component.pc = makeEvoker();
    expect(component.panelTitle).toBe('World of Warcraft Evoker');
    expect(component.subclassLocked).toBeTrue();
  });

  it('lists the Evoker Spells by Sorcerer level for the specialization, from Sorcerer 3', () => {
    component.pc = makeEvoker({ level: 2 });
    expect(component.spellSections).toEqual([]);
    component.pc = makeEvoker({ level: 3 });
    expect(component.spellSections.map(sec => sec.title)).toEqual(['Evoker Spells']);
    expect(component.spellSections[0].entries).toEqual([
      { name: 'Chromatic Orb', classLevel: 3, grantedBy: 'All' },
      { name: "Dragon's Breath", classLevel: 3, grantedBy: 'All' },
      { name: 'Azure Strike', classLevel: 3, grantedBy: 'Devastation' },
      { name: 'Scorching Ray', classLevel: 3, grantedBy: 'Devastation' },
    ]);
    component.pc = makeEvoker({ level: 5 });
    expect(component.spells.map(s => s.name)).toEqual([
      'Chromatic Orb', "Dragon's Breath", 'Azure Strike', 'Scorching Ray', 'Fly', 'Fireball',
    ]);
    component.pc = makeEvoker({ specialization: 'Augmentation', level: 9 });
    expect(component.spells.filter(s => s.grantedBy === 'Augmentation').map(s => s.name))
      .toEqual(['Ebon Might', 'Eruption', 'Blistering Scales', 'Upheaval', 'Breath of Eons']);
    component.pc = makeEvoker({ specialization: 'Preservation', level: 20 });
    expect(component.spells.filter(s => s.grantedBy === 'Preservation').map(s => s.name))
      .toEqual(['Dream Breath', 'Living Flame', 'Emerald Blossom', 'Time Dilation', 'Dream Flight']);
    expect(component.spells.filter(s => s.grantedBy === 'All').map(s => s.name))
      .toEqual(['Chromatic Orb', "Dragon's Breath", 'Fly', 'Arcane Eye', 'Summon Dragon']);
  });

  it('marks the World of Warcraft Evoker Spells with ✦ beside the name', () => {
    const el = render(makeEvoker({ level: 3 }));
    expect(el.querySelector('.hero-spells-title')?.textContent).toContain('Evoker Spells');
    const rows = Array.from(el.querySelectorAll('.hero-spell summary')) as HTMLElement[];
    const marked = rows.filter(r => r.querySelector('.wow-mark'))
      .map(r => r.querySelector('.hero-spell-name')!.textContent);
    expect(marked).toEqual(['Azure Strike']);
    expect(rows[0].querySelector('.hero-spell-meta')!.textContent).toContain('Sorcerer 3');
  });

  it('shows Metamagic, spells to prepare (✦ on WoW ones) and Elemental Affinity, but no subclass recommendation', () => {
    const el = render(makeEvoker());
    const text = el.textContent ?? '';
    expect(text).toContain('World of Warcraft Evoker');
    expect(text).toContain('Recommended Metamagic');
    expect(text).toContain('Empowered Spell and Transmuted Spell');
    expect(text).toContain('Spells to prepare');
    expect(text).toContain('Choose Cold or Fire for Draconic Sorcery');
    expect(text).not.toContain('Recommended subclass');
    expect(text).toContain('dracthyr');
    const prepare = el.querySelector('.hero-extra-prepared') as HTMLElement;
    const marked = Array.from(prepare.querySelectorAll('.suggested-spell'))
      .filter(n => n.querySelector('.wow-mark')).map(n => n.textContent!.replace('✦', '').trim());
    expect(marked).toEqual(['Living Flame']);
    expect(prepare.textContent).toContain('prepared');   // Ice Knife is already prepared
  });

  it('lists the suggested spells per specialization, Otiluke\'s Freezing Sphere included', () => {
    component.pc = makeEvoker();
    expect(component.suggestedSpells.map(r => r.level)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(component.suggestedSpells[3].spells.map(s => s.name)).toEqual(['Azure Sweep', "Otiluke's Freezing Sphere"]);
    component.pc = makeEvoker({ specialization: 'Preservation' });
    expect(component.suggestedSpells[2].spells.map(s => s.name)).toEqual(['Cloudkill', 'Hold Monster', 'Rescue']);
    expect(component.extraPrepared.map(s => s.name))
      .toEqual(['Alter Self', 'Arcane Vigor', 'False Life', 'Hold Person', 'Ray of Sickness', 'Witch Bolt']);
  });
});
