import { Subject, of } from 'rxjs';
import { TestBed } from '@angular/core/testing';

import { LevelUpModalComponent } from './level-up-modal.component';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { PC } from '../../models/pc';
import { LevelUpPreview } from '../../models/level-up';
import { DndSpell } from '../../models/dnd-api.types';

/**
 * Levelling a Monk into, and on as, a Warrior of the Mystic Arts: picking the
 * subclass at Monk 3 asks for two Sorcerer cantrips and three level 1 Sorcerer
 * spells (the preview's `spellcastingBySubclass` entry), later levels use the
 * preview's own deltas, and the spell level is capped by the highest slot.
 */
describe('LevelUpModalComponent (Warrior of the Mystic Arts)', () => {
  const MYSTIC_ARTS = 'Warrior of the Mystic Arts';
  const MONK_SUBCLASSES = [
    'Warrior of Mercy', 'Warrior of Shadow', 'Warrior of the Elements', MYSTIC_ARTS, 'Warrior of the Open Hand',
  ];

  let component: LevelUpModalComponent;
  let pcService: jasmine.SpyObj<PCService>;
  let dndResources: jasmine.SpyObj<DndResourcesService>;

  const dndSpell = (level: number, name: string): DndSpell =>
    ({ level, name, school: 'Evocation', actionType: '1 action', classes: ['sorcerer'] } as unknown as DndSpell);
  const SORCERER_LIST = [
    dndSpell(0, 'Blade Ward'), dndSpell(0, 'Thunderclap'), dndSpell(0, 'Light'),
    dndSpell(1, 'Jump'), dndSpell(1, 'Magic Missile'), dndSpell(1, 'Shield'), dndSpell(1, 'Sleep'),
    dndSpell(2, 'Misty Step'), dndSpell(3, 'Fireball'),
  ];

  const monk = (overrides: Partial<PC> = {}): PC =>
    ({ id: 7, name: 'Shen', clazz: 'Monk', level: 2, playerName: 'Sam', ...overrides });

  function makePreview(overrides: Partial<LevelUpPreview> = {}): LevelUpPreview {
    return {
      currentLevel: 2, newLevel: 3, hitDie: 8, conModifier: 1,
      hpGained: 6, newHpMax: 24, currentProfBonus: 2, newProfBonus: 2,
      currentSpellSlots: {}, newSpellSlots: {},
      subclassDue: false, subclassOptions: [],
      asiDue: false, featOptions: [],
      featuresGained: [],
      fightingStyleDue: false, fightingStyleOptions: [],
      currentCantripsKnown: 0, newCantripsKnown: 0,
      currentSpellsKnown: 0, newSpellsKnown: 0,
      ...overrides,
    };
  }

  /** What the server sends a Monk reaching level 3: only the one subclass changes the spell numbers. */
  const atMonk3 = (): LevelUpPreview => makePreview({
    subclassDue: true, subclassOptions: MONK_SUBCLASSES,
    spellcastingBySubclass: { [MYSTIC_ARTS]: { newSpellSlots: { 1: 2 }, newCantripsKnown: 2, newSpellsKnown: 3 } },
  });

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService',
      ['levelUpPreview', 'levelUp', 'levelUpPreviewAsDm', 'levelUpAsDm']);
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService',
      ['getFeatDescription', 'getSpellsForClass', 'getSpells']);
    dndResources.getFeatDescription.and.returnValue('');
    dndResources.getSpellsForClass.and.returnValue(of(SORCERER_LIST));
    dndResources.getSpells.and.returnValue(of([]));
    pcService.levelUp.and.returnValue(of(monk({ level: 3 })));
    component = TestBed.runInInjectionContext(() => new LevelUpModalComponent(pcService, dndResources));
    component.pc = monk();
  });

  const pick = (...names: string[]): void => {
    component.selectedSpells = names.map(n => SORCERER_LIST.find(s => s.name === n)!);
  };

  describe('picking the subclass at Monk 3', () => {
    beforeEach(() => {
      pcService.levelUpPreview.and.returnValue(of(atMonk3()));
      component.ngOnInit();
    });

    it('asks for no spells before a subclass is picked', () => {
      expect(component.showSpellPicker).toBeFalse();
      expect(component.slotRows).toEqual([]);
      expect(component.showCantrips).toBeFalse();
      expect(dndResources.getSpellsForClass).not.toHaveBeenCalled();
    });

    it('asks for 2 Sorcerer cantrips and 3 level 1 Sorcerer spells once it is picked', () => {
      component.selectedSubclass = MYSTIC_ARTS;

      expect(component.showSpellPicker).toBeTrue();
      expect(component.cantripDelta).toBe(2);
      expect(component.spellDelta).toBe(3);
      expect(component.maxLearnableSpellLevel).toBe(1);
      expect(dndResources.getSpellsForClass).toHaveBeenCalledOnceWith('Sorcerer');
      // Cantrips and level 1 only: the list is capped by the highest slot level.
      expect(component.pickableSpells.map(s => s.name))
        .toEqual(['Blade Ward', 'Thunderclap', 'Light', 'Jump', 'Magic Missile', 'Shield', 'Sleep']);
    });

    it('shows the slots and cantrips the subclass brings', () => {
      component.selectedSubclass = MYSTIC_ARTS;

      expect(component.slotRows).toEqual([{ level: 1, current: 0, next: 2, gained: true }]);
      expect(component.hasSlotChanges).toBeTrue();
      expect(component.showCantrips).toBeTrue();
      expect(component.cantripsChanged).toBeTrue();
      expect(component.preview!.newCantripsKnown).toBe(2);
      // The rest of the preview is the server's.
      expect(component.preview!.subclassOptions).toBe(MONK_SUBCLASSES);
      expect(component.visibleSubclassOptions).toEqual(MONK_SUBCLASSES);
    });

    it('sends the subclass with the five picks as ordinary class spells', () => {
      component.selectedSubclass = MYSTIC_ARTS;
      pick('Blade Ward', 'Thunderclap', 'Jump', 'Magic Missile', 'Shield');
      expect(component.selectedCantripCount).toBe(2);
      expect(component.selectedSpellCount).toBe(3);
      expect(component.canConfirm).toBeTrue();

      component.confirm();

      const choices = pcService.levelUp.calls.mostRecent().args[1]!;
      expect(choices.subclass).toBe(MYSTIC_ARTS);
      expect(choices.newSpells!.map(s => [s.lvl, s.name])).toEqual(
        [[0, 'Blade Ward'], [0, 'Thunderclap'], [1, 'Jump'], [1, 'Magic Missile'], [1, 'Shield']]);
      // Nothing marks them as a feature's: they count against the class's numbers.
      expect(choices.newSpells!.every(s => !s.grantedBy && !s.alwaysPrepared)).toBeTrue();
      expect(choices.subclassChoices).toBeUndefined();
    });

    it('another subclass asks for no spells, and drops picks made for this one', () => {
      component.selectedSubclass = MYSTIC_ARTS;
      pick('Blade Ward', 'Shield');

      component.selectedSubclass = 'Warrior of the Open Hand';

      expect(component.showSpellPicker).toBeFalse();
      expect(component.selectedSpells).toEqual([]);
      expect(component.slotRows).toEqual([]);
      expect(component.preview!.newCantripsKnown).toBe(0);
      component.confirm();
      const choices = pcService.levelUp.calls.mostRecent().args[1]!;
      expect(choices.subclass).toBe('Warrior of the Open Hand');
      expect(choices.newSpells).toBeUndefined();
    });

    it('coming back to it starts the picks over and loads the list again', () => {
      component.selectedSubclass = MYSTIC_ARTS;
      pick('Blade Ward');
      component.selectedSubclass = 'Warrior of Shadow';
      component.selectedSubclass = MYSTIC_ARTS;

      expect(component.selectedSpells).toEqual([]);
      expect(component.spellDelta).toBe(3);
      expect(component.pickableSpells.length).toBe(7);
      expect(dndResources.getSpellsForClass.calls.allArgs()).toEqual([['Sorcerer'], ['Sorcerer']]);
    });

    it('switching between two subclasses without spellcasting keeps everything as it is', () => {
      component.selectedSubclass = 'Warrior of Shadow';
      const preview = component.preview;
      component.selectedSubclass = 'Warrior of Mercy';

      expect(component.preview).toBe(preview);
      expect(dndResources.getSpellsForClass).not.toHaveBeenCalled();
    });

    it('ignores a spell list that arrives after the player moved to another subclass', () => {
      const slow = new Subject<DndSpell[]>();
      dndResources.getSpellsForClass.and.returnValue(slow);
      component.selectedSubclass = MYSTIC_ARTS;
      component.selectedSubclass = 'Warrior of Shadow';

      slow.next(SORCERER_LIST);

      expect(component.spellList).toEqual([]);
      expect(component.showSpellPicker).toBeFalse();
    });

    it('leaves out a spell the Monk already knows', () => {
      component.pc = monk({ spells: [{ lvl: 0, name: 'Light', school: 'Evocation', time: '1 action', prepared: true }] });
      component.selectedSubclass = MYSTIC_ARTS;
      expect(component.pickableSpells.map(s => s.name)).not.toContain('Light');
    });
  });

  describe('later levels of a Mystic Arts monk', () => {
    const mystic = (level: number): PC => monk({ level, subclass: MYSTIC_ARTS });

    it('Monk 7: one more spell, of level 1 or 2, from the Sorcerer list', () => {
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 6, newLevel: 7,
        currentSpellSlots: { 1: 3 }, newSpellSlots: { 1: 4, 2: 2 },
        currentCantripsKnown: 2, newCantripsKnown: 2, currentSpellsKnown: 4, newSpellsKnown: 5,
      })));
      component.pc = mystic(6);
      component.ngOnInit();

      expect(dndResources.getSpellsForClass).toHaveBeenCalledOnceWith('Sorcerer');
      expect(component.cantripDelta).toBe(0);
      expect(component.spellDelta).toBe(1);
      expect(component.maxLearnableSpellLevel).toBe(2);
      expect(component.pickableSpells.map(s => s.name)).toContain('Misty Step');
      expect(component.pickableSpells.map(s => s.name)).not.toContain('Fireball');
      expect(component.slotRows.map(r => [r.level, r.current, r.next])).toEqual([[1, 3, 4], [2, 0, 2]]);
    });

    it('Monk 10: the third cantrip', () => {
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 9, newLevel: 10,
        currentSpellSlots: { 1: 4, 2: 2 }, newSpellSlots: { 1: 4, 2: 3 },
        currentCantripsKnown: 2, newCantripsKnown: 3, currentSpellsKnown: 6, newSpellsKnown: 7,
      })));
      component.pc = mystic(9);
      component.ngOnInit();

      expect(component.cantripDelta).toBe(1);
      expect(component.spellDelta).toBe(1);
      expect(component.cantripsChanged).toBeTrue();
    });

    it('a level with nothing new shows no picker and loads no list', () => {
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 4, newLevel: 5,
        currentSpellSlots: { 1: 3 }, newSpellSlots: { 1: 3 },
        currentCantripsKnown: 2, newCantripsKnown: 2, currentSpellsKnown: 4, newSpellsKnown: 4,
      })));
      component.pc = mystic(4);
      component.ngOnInit();

      expect(component.showSpellPicker).toBeFalse();
      expect(dndResources.getSpellsForClass).not.toHaveBeenCalled();
    });
  });

  describe('every other character', () => {
    it('a Monk of another subclass, or a preview without the field, is as before', () => {
      pcService.levelUpPreview.and.returnValue(of(makePreview({ subclassDue: true, subclassOptions: MONK_SUBCLASSES })));
      component.ngOnInit();
      const preview = component.preview;

      component.selectedSubclass = MYSTIC_ARTS; // a server that predates the field sends no entry

      expect(component.preview).toBe(preview);
      expect(component.showSpellPicker).toBeFalse();
    });

    it('a caster picking a subclass keeps its class list, its numbers and its picks', () => {
      const bard = [dndSpell(1, 'Heroism'), dndSpell(2, 'Invisibility')];
      dndResources.getSpellsForClass.and.returnValue(of(bard));
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        subclassDue: true, subclassOptions: ['College of Lore', 'College of Valor'],
        currentSpellSlots: { 1: 3 }, newSpellSlots: { 1: 4, 2: 2 },
        currentCantripsKnown: 2, newCantripsKnown: 2, currentSpellsKnown: 5, newSpellsKnown: 6,
        spellcastingBySubclass: {},
      })));
      component.pc = monk({ clazz: 'Bard' });
      component.ngOnInit();
      component.selectedSpells = [bard[1]];

      component.selectedSubclass = 'College of Lore';

      expect(dndResources.getSpellsForClass).toHaveBeenCalledOnceWith('Bard');
      expect(component.selectedSpells).toEqual([bard[1]]);
      expect(component.spellDelta).toBe(1);
    });

    it('an Eldritch Knight gets no picks', () => {
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        subclassDue: true, subclassOptions: ['Champion', 'Eldritch Knight'], spellcastingBySubclass: {},
      })));
      component.pc = monk({ clazz: 'Fighter' });
      component.ngOnInit();

      component.selectedSubclass = 'Eldritch Knight';

      expect(component.showSpellPicker).toBeFalse();
      expect(component.slotRows).toEqual([]);
      expect(dndResources.getSpellsForClass).not.toHaveBeenCalled();
    });
  });
});
