import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EbonBladePanelComponent, isEbonBlade } from './ebon-blade-panel.component';
import { DndResourcesService } from '../../../../services/dnd-resources.service';
import { DndSpell } from '../../../../models/dnd-api.types';
import { PC } from '../../../../models/pc';

function makePC(overrides: Partial<PC> = {}): PC {
  return {
    id: 6, name: 'Isolde', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', rune: 'Frost',
    level: 5, playerName: 'Frank', stats: { STR: 17, DEX: 10, CON: 15, INT: 8, WIS: 12, CHA: 14 },
    ...overrides,
  };
}

describe('EbonBladePanelComponent', () => {
  let dndResources: jasmine.SpyObj<DndResourcesService>;
  let component: EbonBladePanelComponent;

  const deathGrip = {
    name: 'Death Grip', level: 1, school: 'necromancy', classes: [], actionType: 'action',
    concentration: false, ritual: false, range: 'TBD', components: ['v', 's'], duration: 'TBD',
    description: 'Stub text.', source: 'World of Warcraft',
  } as DndSpell;

  beforeEach(() => {
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getSpells']);
    dndResources.getSpells.and.returnValue(of([deathGrip]));
    TestBed.configureTestingModule({ providers: [{ provide: DndResourcesService, useValue: dndResources }] });
    component = TestBed.runInInjectionContext(() => new EbonBladePanelComponent());
  });

  it('recognizes Ebon Blade characters by subclass', () => {
    expect(isEbonBlade(makePC())).toBeTrue();
    expect(isEbonBlade(makePC({ subclass: 'Oath of Devotion' }))).toBeFalse();
    expect(isEbonBlade(null)).toBeFalse();
  });

  it('lists the oath spells for the level and rune', () => {
    component.pc = makePC();
    expect(component.oathSpells.map(s => s.name))
      .toEqual(['Rune Strike', 'Death Grip', 'Chains of Ice', 'Death and Decay', 'Frostscythe']);
  });

  it('loads spell data once and looks spells up by name', () => {
    component.pc = makePC();
    component.pc = makePC({ level: 6 });
    expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
    expect(component.spellFor('death grip')?.description).toBe('Stub text.');
  });

  it('does not fetch spells at level 1 (no oath spells yet)', () => {
    component.pc = makePC({ level: 1 });
    expect(component.oathSpells).toEqual([]);
    expect(dndResources.getSpells).not.toHaveBeenCalled();
  });

  it('sizes the Death Coil pool at 1 + CHA modifier, never below one die', () => {
    component.pc = makePC();                                    // CHA 14 → +2
    expect(component.deathCoilDice).toBe(3);
    component.pc = makePC({ level: 1, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 6 } });
    expect(component.deathCoilDice).toBe(1);
  });

  it('describes the chosen rune', () => {
    component.pc = makePC({ rune: 'Blood' });
    expect(component.runeDesc).toContain('tank');
  });
});
