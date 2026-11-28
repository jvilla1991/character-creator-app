import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';

import { LevelUpModalComponent } from './level-up-modal.component';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { PC } from '../../models/pc';
import { LevelUpPreview } from '../../models/level-up';
import { WOW_PRIEST_EXTRA_SPELLS } from '../../models/wow-class-variants';
import { SubclassChoiceResult } from './subclass-choices/subclass-choices.component';
import { DndSpell } from '../../models/dnd-api.types';

/** A SpyObj PCService — the modal only touches the preview/commit pairs (owner + as-dm). */
function makePcServiceSpy(): jasmine.SpyObj<PCService> {
  return jasmine.createSpyObj<PCService>('PCService',
    ['levelUpPreview', 'levelUp', 'levelUpPreviewAsDm', 'levelUpAsDm']);
}

function makePC(overrides: Partial<PC> = {}): PC {
  return { id: 7, name: 'Throk', clazz: 'Barbarian', level: 4, playerName: 'Ben', ...overrides };
}

function makePreview(overrides: Partial<LevelUpPreview> = {}): LevelUpPreview {
  return {
    currentLevel: 4, newLevel: 5, hitDie: 12, conModifier: 1,
    hpGained: 8, newHpMax: 92, currentProfBonus: 2, newProfBonus: 3,
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

describe('LevelUpModalComponent', () => {
  let component: LevelUpModalComponent;
  let pcService: jasmine.SpyObj<PCService>;
  let dndResources: jasmine.SpyObj<DndResourcesService>;

  beforeEach(() => {
    pcService = makePcServiceSpy();
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService',
      ['getFeatDescription', 'getSpellsForClass', 'getSpells']);
    dndResources.getFeatDescription.and.returnValue('A mighty feat.');
    dndResources.getSpellsForClass.and.returnValue(of([]));
    dndResources.getSpells.and.returnValue(of([]));
    component = TestBed.runInInjectionContext(() => new LevelUpModalComponent(pcService, dndResources));
    component.pc = makePC();
  });

  it('loads the preview on init', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));

    component.ngOnInit();

    expect(pcService.levelUpPreview).toHaveBeenCalledWith(7);
    expect(component.loading).toBeFalse();
    expect(component.preview?.newLevel).toBe(5);
  });

  it('surfaces a preview error and stops loading', () => {
    pcService.levelUpPreview.and.returnValue(
      throwError(() => ({ error: { message: 'Character is already at the maximum level (20)' } }))
    );

    component.ngOnInit();

    expect(component.loading).toBeFalse();
    expect(component.preview).toBeNull();
    expect(component.error).toContain('maximum level');
  });

  it('reports a proficiency-bonus bump', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentProfBonus: 2, newProfBonus: 3 })));
    component.ngOnInit();
    expect(component.profChanged).toBeTrue();
  });

  it('reports no proficiency change within a band', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentProfBonus: 2, newProfBonus: 2 })));
    component.ngOnInit();
    expect(component.profChanged).toBeFalse();
  });

  it('builds sorted spell-slot rows and flags gained slots (caster)', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentSpellSlots: { 1: 4, 2: 3, 3: 3, 4: 1 },
      newSpellSlots: { 1: 4, 2: 3, 3: 3, 4: 2 }, // bard 7 -> 8: +1 level-4 slot
    })));
    component.ngOnInit();

    expect(component.slotRows.map(r => r.level)).toEqual([1, 2, 3, 4]);
    expect(component.hasSlotChanges).toBeTrue();
    const lvl4 = component.slotRows.find(r => r.level === 4)!;
    expect(lvl4.current).toBe(1);
    expect(lvl4.next).toBe(2);
    expect(lvl4.gained).toBeTrue();
  });

  it('has no slot rows for a non-caster', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentSpellSlots: {}, newSpellSlots: {} })));
    component.ngOnInit();
    expect(component.slotRows.length).toBe(0);
    expect(component.hasSlotChanges).toBeFalse();
  });

  it('commits the level-up and emits close on success', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
    const closeSpy = jasmine.createSpy('close');
    component.close.subscribe(closeSpy);

    component.ngOnInit();
    component.confirm();

    expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
    expect(closeSpy).toHaveBeenCalled();
  });

  // --- HP mode toggle (average vs roll) ---

  it('defaults to AVERAGE HP mode and omits it from the choices', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
    component.ngOnInit();

    expect(component.hpMode).toBe('AVERAGE');

    component.confirm();
    // AVERAGE is implied — nothing extra is sent (server defaults to it).
    expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
  });

  it('sends hpMode ROLL when the player picks Roll', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
    component.ngOnInit();

    component.hpMode = 'ROLL';
    component.confirm();

    expect(pcService.levelUp).toHaveBeenCalledWith(7, { hpMode: 'ROLL' });
  });

  it('combines the ROLL mode with other choices', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      subclassDue: true, subclassOptions: ['Life Domain', 'War Domain'],
    })));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
    component.ngOnInit();

    component.selectedSubclass = 'War Domain';
    component.hpMode = 'ROLL';
    component.confirm();

    expect(pcService.levelUp).toHaveBeenCalledWith(7, { hpMode: 'ROLL', subclass: 'War Domain' });
  });

  // --- subclass picker (Phase 3) ---

  it('does not show the subclass picker when options are empty (mechanism dormant)', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ subclassDue: true, subclassOptions: [] })));
    component.ngOnInit();
    expect(component.needsSubclass).toBeFalse();
    expect(component.canConfirm).toBeTrue();
  });

  it('requires a subclass choice when options are offered', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      subclassDue: true, subclassOptions: ['Life Domain', 'War Domain'],
    })));
    component.ngOnInit();

    expect(component.needsSubclass).toBeTrue();
    expect(component.canConfirm).toBeFalse(); // nothing picked yet

    component.selectedSubclass = 'War Domain';
    expect(component.canConfirm).toBeTrue();
  });

  it('blocks confirm until a required subclass is chosen, then sends it', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      subclassDue: true, subclassOptions: ['Life Domain', 'War Domain'],
    })));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
    component.ngOnInit();

    component.confirm(); // no selection -> blocked
    expect(pcService.levelUp).not.toHaveBeenCalled();

    component.selectedSubclass = 'Life Domain';
    component.confirm();
    expect(pcService.levelUp).toHaveBeenCalledWith(7, { subclass: 'Life Domain' });
  });

  // --- ASI allocator (Phase 4) ---

  it('does not show the ASI allocator when none is due', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ asiDue: false })));
    component.ngOnInit();
    expect(component.needsAsi).toBeFalse();
    expect(component.canConfirm).toBeTrue();
  });

  it('requires exactly 2 ASI points before confirm when an ASI is due', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ asiDue: true })));
    component.pc = { id: 7, name: 'Throk', clazz: 'Fighter', level: 3, playerName: 'Ben',
                     stats: { STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 8 } };
    component.ngOnInit();

    expect(component.needsAsi).toBeTrue();
    expect(component.canConfirm).toBeFalse();

    component.incAsi('STR');         // +1 -> not enough
    expect(component.canConfirm).toBeFalse();
    component.incAsi('STR');         // +2 -> valid
    expect(component.canConfirm).toBeTrue();
    expect(component.newScore('STR')).toBe(18);
  });

  it('caps a single ability at +2 and the total at 2 points', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ asiDue: true })));
    component.pc = { id: 7, name: 'Throk', clazz: 'Fighter', level: 3, playerName: 'Ben',
                     stats: { STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 8 } };
    component.ngOnInit();

    component.incAsi('STR'); component.incAsi('STR');
    expect(component.canInc('STR')).toBeFalse(); // per-ability cap of +2
    expect(component.canInc('DEX')).toBeFalse(); // no points left
  });

  it('does not let an ability exceed 20', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ asiDue: true })));
    component.pc = { id: 7, name: 'Throk', clazz: 'Fighter', level: 3, playerName: 'Ben',
                     stats: { STR: 20, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 8 } };
    component.ngOnInit();
    expect(component.canInc('STR')).toBeFalse();
  });

  it('sends the ASI allocation in the choices', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ asiDue: true })));
    pcService.levelUp.and.returnValue(of(makePC({ level: 4 })));
    component.pc = { id: 7, name: 'Throk', clazz: 'Fighter', level: 3, playerName: 'Ben',
                     stats: { STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 8 } };
    component.ngOnInit();

    component.incAsi('STR'); component.incAsi('DEX');
    component.confirm();

    expect(pcService.levelUp).toHaveBeenCalledWith(7, { abilityIncreases: { STR: 1, DEX: 1 } });
  });

  // --- Feat as the ASI alternative ---

  it('can switch to feat mode and confirm requires a feat selection', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      asiDue: true, featOptions: ['Sentinel', 'Sharpshooter'],
    })));
    component.pc = { id: 7, name: 'Throk', clazz: 'Fighter', level: 3, playerName: 'Ben',
                     stats: { STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 8 } };
    component.ngOnInit();

    component.milestoneMode = 'feat';
    expect(component.canConfirm).toBeFalse();   // no feat picked
    component.selectedFeat = 'Sentinel';
    expect(component.canConfirm).toBeTrue();
  });

  it('sends the chosen feat (and no ASI) when in feat mode', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      asiDue: true, featOptions: ['Sentinel', 'Sharpshooter'],
    })));
    pcService.levelUp.and.returnValue(of(makePC({ level: 4 })));
    component.pc = { id: 7, name: 'Throk', clazz: 'Fighter', level: 3, playerName: 'Ben',
                     stats: { STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 8 } };
    component.ngOnInit();

    component.milestoneMode = 'feat';
    component.selectedFeat = 'Sharpshooter';
    component.confirm();

    expect(pcService.levelUp).toHaveBeenCalledWith(7, { feat: 'Sharpshooter' });
  });

  it('exposes featOptions from the preview', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ asiDue: true, featOptions: ['Sentinel'] })));
    component.ngOnInit();
    expect(component.featOptions).toEqual(['Sentinel']);
  });

  // --- auto-granted class features ---

  it('exposes auto-granted class features from the preview', () => {
    const feats = [{ name: 'Reckless Attack', desc: 'Attack with advantage.' }];
    pcService.levelUpPreview.and.returnValue(of(makePreview({ featuresGained: feats })));
    component.ngOnInit();
    expect(component.featuresGained).toEqual(feats);
  });

  it('has no class features when none are granted', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ featuresGained: [] })));
    component.ngOnInit();
    expect(component.featuresGained.length).toBe(0);
  });

  // --- cantrips known ---

  it('shows a cantrips-known increase for casters', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentCantripsKnown: 3, newCantripsKnown: 4 })));
    component.ngOnInit();
    expect(component.showCantrips).toBeTrue();
    expect(component.cantripsChanged).toBeTrue();
  });

  it('hides the cantrips row for non-casters', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentCantripsKnown: 0, newCantripsKnown: 0 })));
    component.ngOnInit();
    expect(component.showCantrips).toBeFalse();
  });

  // --- DM cross-link mode (asDm) ---

  it('uses the DM-authorized preview and commit when asDm is set', () => {
    pcService.levelUpPreviewAsDm.and.returnValue(of(makePreview()));
    pcService.levelUpAsDm.and.returnValue(of(makePC({ level: 5 })));
    const closeSpy = jasmine.createSpy('close');
    component.close.subscribe(closeSpy);

    component.asDm = true;
    component.ngOnInit();
    component.confirm();

    expect(pcService.levelUpPreviewAsDm).toHaveBeenCalledWith(7);
    expect(pcService.levelUpPreview).not.toHaveBeenCalled();
    expect(pcService.levelUpAsDm).toHaveBeenCalledWith(7, {});
    expect(pcService.levelUp).not.toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('uses the owner path when asDm is not set (regression guard)', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));

    component.ngOnInit();
    component.confirm();

    expect(pcService.levelUpPreviewAsDm).not.toHaveBeenCalled();
    expect(pcService.levelUpAsDm).not.toHaveBeenCalled();
  });

  it('keeps the modal open and shows an error if the commit fails', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    pcService.levelUp.and.returnValue(throwError(() => ({ error: { message: 'Level-up failed.' } })));
    const closeSpy = jasmine.createSpy('close');
    component.close.subscribe(closeSpy);

    component.ngOnInit();
    component.confirm();

    expect(closeSpy).not.toHaveBeenCalled();
    expect(component.submitting).toBeFalse();
    expect(component.error).toBe('Level-up failed.');
  });

  it('does not commit while one is already in flight', () => {
    pcService.levelUpPreview.and.returnValue(of(makePreview()));
    component.ngOnInit();

    component.submitting = true; // simulate a commit already running
    component.confirm();

    expect(pcService.levelUp).not.toHaveBeenCalled();
  });

  // --- spell selection ---

  function dndSpell(level: number, name: string): any {
    return { level, name, school: 'Evocation', actionType: '1 action', classes: ['bard'] };
  }

  it('shows the picker and loads the class spell list, passing deltas through as picker limits', () => {
    dndResources.getSpellsForClass.and.returnValue(of(
      [dndSpell(0, 'Light'), dndSpell(1, 'Heroism'), dndSpell(2, 'Invisibility')] as any));
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentCantripsKnown: 2, newCantripsKnown: 2,   // cantrip delta 0
      currentSpellsKnown: 7, newSpellsKnown: 9,        // spell delta 2
      newSpellSlots: { 1: 4, 2: 3, 3: 2 },             // slots up to spell level 3 at the new level
    })));
    component.pc = makePC({ clazz: 'Bard', spells: [] });
    component.ngOnInit();

    expect(component.showSpellPicker).toBeTrue();
    expect(component.cantripDelta).toBe(0);
    expect(component.spellDelta).toBe(2);
    expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('Bard');
    // The modal hands the castable candidate list to app-spell-picker along with the deltas as
    // cantripLimit/spellLimit — the picker (tested separately) applies the level-0/level>0 filter.
    expect(component.spellList.map(s => s.name)).toEqual(['Light', 'Heroism', 'Invisibility']);
  });

  it('filters out spells above the highest slot level at the new level', () => {
    // Bard 4 -> 5: slots reach spell level 3 — Polymorph (L4) must not be offered.
    dndResources.getSpellsForClass.and.returnValue(of(
      [dndSpell(0, 'Light'), dndSpell(3, 'Fear'), dndSpell(4, 'Polymorph'), dndSpell(9, 'Wish')] as any));
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentSpellsKnown: 7, newSpellsKnown: 9,
      newSpellSlots: { 1: 4, 2: 3, 3: 2 },
    })));
    component.pc = makePC({ clazz: 'Bard', spells: [] });
    component.ngOnInit();

    expect(component.maxLearnableSpellLevel).toBe(3);
    expect(component.spellList.map(s => s.name)).toEqual(['Light', 'Fear']);
  });

  it('caps warlock candidates at the pact slot level', () => {
    // Warlock 4 -> 5: the single pact entry is spell level 3.
    dndResources.getSpellsForClass.and.returnValue(of(
      [dndSpell(3, 'Fly'), dndSpell(5, 'Hold Monster')] as any));
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentSpellsKnown: 5, newSpellsKnown: 6,
      newSpellSlots: { 3: 2 },
    })));
    component.pc = makePC({ clazz: 'Warlock', spells: [] });
    component.ngOnInit();

    expect(component.maxLearnableSpellLevel).toBe(3);
    expect(component.spellList.map(s => s.name)).toEqual(['Fly']);
  });

  it('always offers cantrips regardless of the slot-level cap', () => {
    dndResources.getSpellsForClass.and.returnValue(of(
      [dndSpell(0, 'Mending'), dndSpell(1, 'Heroism')] as any));
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentCantripsKnown: 3, newCantripsKnown: 4,   // cantrip delta 1
      newSpellSlots: { 1: 2 },
    })));
    component.pc = makePC({ clazz: 'Bard', spells: [] });
    component.ngOnInit();

    expect(component.spellList.map(s => s.name)).toEqual(['Mending', 'Heroism']);
  });

  it('caps spell selection at the allowed delta (as the spell-picker would enforce via selectedChange)', () => {
    const spells = [dndSpell(1, 'A'), dndSpell(1, 'B'), dndSpell(1, 'C')];
    dndResources.getSpellsForClass.and.returnValue(of(spells as any));
    pcService.levelUpPreview.and.returnValue(of(makePreview({ currentSpellsKnown: 7, newSpellsKnown: 9 })));
    component.pc = makePC({ clazz: 'Bard', spells: [] });
    component.ngOnInit();

    // The picker enforces the limit before emitting; the modal just accepts whatever
    // selectedChange emits. Simulate the picker allowing exactly 2 (the delta) through.
    component.selectedSpells = [spells[0], spells[1]];
    expect(component.selectedSpellCount).toBe(2);
  });

  it('excludes already-known spells from the list', () => {
    const spells = [dndSpell(1, 'Hold Person'), dndSpell(1, 'Heroism')];
    dndResources.getSpellsForClass.and.returnValue(of(spells as any));
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentSpellsKnown: 7, newSpellsKnown: 9, newSpellSlots: { 1: 4, 2: 3 },
    })));
    component.pc = makePC({ clazz: 'Bard',
      spells: [{ lvl: 1, name: 'Heroism', school: 'Ench', time: '1 action', prepared: true }] });
    component.ngOnInit();

    expect(component.spellList.map(s => s.name)).toEqual(['Hold Person']);
  });

  it('sends selected spells as newSpells mapped to PcSpell', () => {
    const spells = [dndSpell(1, 'Hold Person')];
    dndResources.getSpellsForClass.and.returnValue(of(spells as any));
    pcService.levelUpPreview.and.returnValue(of(makePreview({
      currentSpellsKnown: 7, newSpellsKnown: 9, newSpellSlots: { 1: 4, 2: 3 },
    })));
    pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
    component.pc = makePC({ clazz: 'Bard', spells: [] });
    component.ngOnInit();

    // Simulate the spell-picker's (selectedChange) output, which the template binds
    // directly onto selectedSpells.
    component.selectedSpells = [spells[0]];
    component.confirm();

    expect(pcService.levelUp).toHaveBeenCalledWith(7, {
      newSpells: [jasmine.objectContaining({ lvl: 1, name: 'Hold Person', prepared: true })],
    });
  });

  // --- Hero-class specialization change (respecOnLevelUp) ---

  describe('Death Knight rune change (respec allowed)', () => {
    beforeEach(() => {
      component.pc = makePC({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Frost', level: 4 });
      pcService.levelUpPreview.and.returnValue(of(makePreview()));
      pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
      component.ngOnInit();
    });

    it('shows the change control, defaulting to the current rune', () => {
      expect(component.canRespec).toBeTrue();
      expect(component.heroClass?.specializationLabel).toBe('rune');
      expect(component.selectedSpecialization).toBe('Frost');
    });

    it('does not send a specialization when it is left unchanged', () => {
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
    });

    it('sends the new specialization when the player changes it', () => {
      component.selectedSpecialization = 'Unholy';
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, { specialization: 'Unholy' });
    });

    it('never sends a specialization for a non-hero character', () => {
      const other = TestBed.runInInjectionContext(() => new LevelUpModalComponent(pcService, dndResources));
      other.pc = makePC({ clazz: 'Paladin', subclass: 'Oath of Devotion' });
      other.ngOnInit();
      other.selectedSpecialization = 'Blood';
      pcService.levelUp.calls.reset();
      other.confirm();
      expect(other.canRespec).toBeFalse();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
    });
  });

  describe('Demon Hunter (no respec)', () => {
    it('hides the change control and never sends a specialization', () => {
      component.pc = makePC({ clazz: 'Ranger', subclass: 'Demon Hunter', specialization: 'Havoc', level: 4 });
      pcService.levelUpPreview.and.returnValue(of(makePreview()));
      pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
      component.ngOnInit();
      expect(component.heroClass?.name).toBe('Demon Hunter');
      expect(component.canRespec).toBeFalse();
      component.selectedSpecialization = 'Vengeance';
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
    });
  });

  describe('World of Warcraft Druid (respec allowed, recommended circle)', () => {
    const circles = ['Circle of the Land', 'Circle of the Moon', 'Circle of the Sea', 'Circle of the Stars'];
    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Druid', level: 2, ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: circles, ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
      component.ngOnInit();
    }

    it('shows the "Change specialization" control for a WoW druid', () => {
      open({ specialization: 'Balance' });
      expect(component.canRespec).toBeTrue();
      expect(component.heroClass?.specializationLabel).toBe('specialization');
      expect(component.heroClass?.specializations.map(s => s.name))
        .toEqual(['Balance', 'Feral', 'Guardian', 'Restoration']);
      component.selectedSpecialization = 'Feral';
      component.selectedSubclass = 'Circle of the Moon';
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, { subclass: 'Circle of the Moon', specialization: 'Feral' });
    });

    it('does not offer a respec to a base druid (no specialization)', () => {
      open({ specialization: null });
      expect(component.heroClass).toBeUndefined();
      expect(component.canRespec).toBeFalse();
      expect(component.recommendedSubclass).toBeNull();
    });

    it('derives the recommended circle from the specialization when the server sends none', () => {
      open({ specialization: 'Guardian' });
      expect(component.recommendedSubclass).toBe('Circle of the Moon');
      expect(component.recommendationSpecialization).toBe('Guardian');
    });

    it("uses the server's recommendedSubclass while the specialization is unchanged", () => {
      open({ specialization: 'Balance' }, { recommendedSubclass: 'Circle of the Stars' });
      expect(component.recommendedSubclass).toBe('Circle of the Stars');
    });

    it('follows a respec picked in the same level-up', () => {
      open({ specialization: 'Balance' }, { recommendedSubclass: 'Circle of the Stars' });
      component.selectedSpecialization = 'Restoration';
      expect(component.recommendedSubclass).toBe('Circle of the Land');
      expect(component.recommendationSpecialization).toBe('Restoration');
    });

    it('never highlights a circle that is not on offer, and never pre-selects one', () => {
      open({ specialization: 'Feral' }, { subclassOptions: ['Circle of the Land'] });
      expect(component.recommendedSubclass).toBeNull();
      expect(component.selectedSubclass).toBeNull();
    });
  });

  // --- Level-2 Fighting Style and the cantrip-teaching styles ---

  describe('Fighting Style (level 2)', () => {
    const cantrip = (name: string, classes = ['warlock']) => ({
      name, level: 0, school: 'necromancy', classes, actionType: 'action', concentration: false,
      ritual: false, range: '120 feet', components: ['v', 's'], duration: 'Instantaneous', description: '',
    }) as any;
    const styles = ['Archery', 'Defense', 'Druidic Warrior', 'Two-Weapon Fighting', 'Void Warrior'];

    beforeEach(() => {
      component.pc = makePC({
        clazz: 'Ranger', subclass: 'Demon Hunter', specialization: 'Havoc', level: 1,
        spells: [{ lvl: 0, name: 'Eldritch Blast', school: 'Evocation', time: '1 action', prepared: true }],
      });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 1, newLevel: 2, fightingStyleDue: true, fightingStyleOptions: styles,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 2 })));
      dndResources.getSpellsForClass.and.returnValue(of([
        cantrip('Chill Touch'), cantrip('Mind Sliver'), cantrip('Eldritch Blast'), cantrip('Toll the Dead'),
        { ...cantrip('Hex'), level: 1 },
      ]));
      dndResources.getSpellsForClass.withArgs('druid').and.returnValue(of([
        cantrip('Druidcraft', ['druid']), cantrip('Thorn Whip', ['druid']), cantrip('Guidance', ['druid']),
        { ...cantrip('Entangle', ['druid']), level: 1 },
      ]));
      component.ngOnInit();
    });

    it('shows the picker with the server options when a fighting style is due', () => {
      expect(component.needsFightingStyle).toBeTrue();
      expect(component.fightingStyleOptions).toEqual(styles);
    });

    it('hides the picker when no fighting style is due', () => {
      pcService.levelUpPreview.and.returnValue(of(makePreview({ fightingStyleOptions: styles })));
      component.ngOnInit();
      expect(component.needsFightingStyle).toBeFalse();
    });

    it('is optional: confirming without a style sends no fightingStyle', () => {
      expect(component.canConfirm).toBeTrue();
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
    });

    it('sends a plain fighting style on its own', () => {
      component.selectFightingStyle('Archery');
      expect(component.cantripStyle).toBeNull();
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, { fightingStyle: 'Archery' });
    });

    it('clicking the chosen style again clears it', () => {
      component.selectFightingStyle('Defense');
      component.selectFightingStyle('Defense');
      expect(component.selectedFightingStyle).toBe('');
    });

    it('Void Warrior offers unknown Warlock cantrips only and requires exactly two', () => {
      component.selectFightingStyle('Void Warrior');
      expect(component.cantripStyle?.spellList).toBe('warlock');
      expect(component.cantripStyle?.hint).toContain('Chill Touch');
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('warlock');
      expect(component.styleCantripOptions.map(s => s.name)).toEqual(['Chill Touch', 'Mind Sliver', 'Toll the Dead']);
      expect(component.canConfirm).toBeFalse();
      component.styleCantrips = [component.styleCantripOptions[0]];
      expect(component.canConfirm).toBeFalse();
      component.confirm();
      expect(pcService.levelUp).not.toHaveBeenCalled();
      component.styleCantrips = component.styleCantripOptions.slice(0, 3);
      expect(component.canConfirm).toBeFalse();
      component.styleCantrips = component.styleCantripOptions.slice(0, 2);
      expect(component.canConfirm).toBeTrue();
    });

    it('sends Void Warrior with its two cantrips in newSpells', () => {
      component.selectFightingStyle('Void Warrior');
      component.styleCantrips = component.styleCantripOptions.slice(0, 2);
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        fightingStyle: 'Void Warrior',
        newSpells: [
          jasmine.objectContaining({ lvl: 0, name: 'Chill Touch' }),
          jasmine.objectContaining({ lvl: 0, name: 'Mind Sliver' }),
        ],
      });
    });

    it('drops the Void Warrior cantrips when another style is picked', () => {
      component.selectFightingStyle('Void Warrior');
      component.styleCantrips = component.styleCantripOptions.slice(0, 2);
      component.selectFightingStyle('Archery');
      expect(component.styleCantrips).toEqual([]);
      expect(component.canConfirm).toBeTrue();
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, { fightingStyle: 'Archery' });
    });

    it('Druidic Warrior requires exactly two Druid cantrips (no hint) and sends them', () => {
      component.selectFightingStyle('Druidic Warrior');
      expect(component.cantripStyle?.className).toBe('Druid');
      expect(component.cantripStyle?.hint).toBeUndefined();
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('druid');
      expect(component.styleCantripOptions.map(s => s.name)).toEqual(['Druidcraft', 'Thorn Whip', 'Guidance']);
      expect(component.canConfirm).toBeFalse();
      component.styleCantrips = component.styleCantripOptions.slice(1, 3);
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        fightingStyle: 'Druidic Warrior',
        newSpells: [
          jasmine.objectContaining({ lvl: 0, name: 'Thorn Whip' }),
          jasmine.objectContaining({ lvl: 0, name: 'Guidance' }),
        ],
      });
    });

    it('switching between cantrip styles swaps the list, clears picks and fetches each list once', () => {
      component.selectFightingStyle('Void Warrior');
      component.styleCantrips = component.styleCantripOptions.slice(0, 2);
      component.selectFightingStyle('Druidic Warrior');
      expect(component.styleCantrips).toEqual([]);
      expect(component.styleCantripOptions.map(s => s.name)).toContain('Thorn Whip');
      component.selectFightingStyle('Void Warrior');
      expect(component.styleCantripOptions.map(s => s.name)).toContain('Chill Touch');
      expect(dndResources.getSpellsForClass.calls.allArgs()).toEqual([['warlock'], ['druid']]);
    });

    it('sends the fighting style through the DM path too', () => {
      const dm = TestBed.runInInjectionContext(() => new LevelUpModalComponent(pcService, dndResources));
      dm.pc = component.pc;
      dm.asDm = true;
      pcService.levelUpPreviewAsDm.and.returnValue(of(makePreview({ fightingStyleDue: true, fightingStyleOptions: styles })));
      pcService.levelUpAsDm.and.returnValue(of(makePC({ level: 2 })));
      dm.ngOnInit();
      dm.selectFightingStyle('Defense');
      dm.confirm();
      expect(pcService.levelUpAsDm).toHaveBeenCalledWith(7, { fightingStyle: 'Defense' });
    });
  });
  describe('World of Warcraft Paladin (oath, Blessed Warrior, recommended styles)', () => {
    const cantrip = (name: string) => ({
      name, level: 0, school: 'evocation', classes: ['cleric'], actionType: 'action', concentration: false,
      ritual: false, range: '60 feet', components: ['v', 's'], duration: 'Instantaneous', description: '',
    }) as any;
    const styles = ['Blessed Warrior', 'Defense', 'Great Weapon Fighting', 'Interception', 'Protection'];
    const oaths = ['Oath of Devotion', 'Oath of Glory', 'Oath of the Ancients', 'Oath of the Holy', 'Oath of Vengeance'];

    /** Render the real template against the same spies (the shared TestBed is already in use). */
    function renderModal(): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({
        clazz: 'Paladin', level: 1, specialization: 'Holy',
        spells: [{ lvl: 0, name: 'Spare the Dying', school: 'Necromancy', time: '1 action', prepared: true }],
        ...pc,
      });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 1, newLevel: 2, fightingStyleDue: true, fightingStyleOptions: styles, ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 2 })));
      dndResources.getSpellsForClass.and.returnValue(of([
        cantrip('Guidance'), cantrip('Sacred Flame'), cantrip('Spare the Dying'), cantrip('Thaumaturgy'),
        { ...cantrip('Bless'), level: 1 },
      ]));
      component.ngOnInit();
    }

    it('Blessed Warrior offers unknown Cleric cantrips with a hint and requires exactly two', () => {
      open({});
      component.selectFightingStyle('Blessed Warrior');
      expect(component.cantripStyle?.spellList).toBe('cleric');
      expect(component.cantripStyle?.hint).toContain('Sacred Flame');
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('cleric');
      expect(component.styleCantripOptions.map(s => s.name)).toEqual(['Guidance', 'Sacred Flame', 'Thaumaturgy']);
      expect(component.canConfirm).toBeFalse();
      component.styleCantrips = [component.styleCantripOptions[1], component.styleCantripOptions[2]];
      expect(component.canConfirm).toBeTrue();
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        fightingStyle: 'Blessed Warrior',
        newSpells: [
          jasmine.objectContaining({ lvl: 0, name: 'Sacred Flame' }),
          jasmine.objectContaining({ lvl: 0, name: 'Thaumaturgy' }),
        ],
      });
    });

    it('offers a level 2 paladin one new prepared spell from the Paladin list, with no cantrip pick', () => {
      const bless = { ...cantrip('Bless'), level: 1, classes: ['paladin'] };
      open({ spells: [] }, { currentSpellsKnown: 2, newSpellsKnown: 3, newSpellSlots: { 1: 2 } });
      dndResources.getSpellsForClass.and.returnValue(of([bless, { ...cantrip('Aid'), level: 2 }]));
      component.ngOnInit();
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('Paladin');
      expect(component.showSpellPicker).toBeTrue();
      expect([component.cantripDelta, component.spellDelta]).toEqual([0, 1]);
      expect(component.showCantrips).toBeFalse();
      // Only 1st-level slots at level 2, so the 2nd-level spell is not offered.
      expect(component.spellList.map(s => s.name)).toEqual(['Bless']);
    });

    it('sends the level 2 spell and the Blessed Warrior cantrips in one request', () => {
      open({ spells: [] }, { currentSpellsKnown: 2, newSpellsKnown: 3, newSpellSlots: { 1: 2 } });
      const bless = { ...cantrip('Bless'), level: 1 };
      component.selectedSpells = [bless];
      component.selectFightingStyle('Blessed Warrior');
      component.styleCantrips = [cantrip('Guidance'), cantrip('Sacred Flame')];
      expect(component.canConfirm).toBeTrue();
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        fightingStyle: 'Blessed Warrior',
        newSpells: [
          jasmine.objectContaining({ lvl: 1, name: 'Bless' }),
          jasmine.objectContaining({ lvl: 0, name: 'Guidance' }),
          jasmine.objectContaining({ lvl: 0, name: 'Sacred Flame' }),
        ],
      });
    });

    it('shows a spell the level always keeps prepared and sends it marked, outside the picks', () => {
      const findSteed = { ...cantrip('Find Steed'), level: 2, classes: ['paladin'] };
      const aid = { ...cantrip('Aid'), level: 2, classes: ['paladin'] };
      dndResources.getSpells.and.returnValue(of([findSteed, aid]));
      open({ level: 4, subclass: 'Oath of Devotion', spells: [] }, {
        currentLevel: 4, newLevel: 5, fightingStyleDue: false, fightingStyleOptions: [],
        currentSpellsKnown: 5, newSpellsKnown: 6, newSpellSlots: { 1: 4, 2: 2 },
        alwaysPreparedSpells: [{ name: 'Find Steed', grantedBy: 'Faithful Steed' }],
      });
      dndResources.getSpellsForClass.and.returnValue(of([findSteed, aid]));
      component.ngOnInit();

      expect(component.alwaysPreparedGrants).toEqual([{ name: 'Find Steed', grantedBy: 'Faithful Steed' }]);
      expect(component.grantedSpells.map(g => g.spell.name)).toEqual(['Find Steed']);
      // The granted spell is not offered as the level's pick.
      expect(component.pickableSpells.map(s => s.name)).toEqual(['Aid']);
      expect(component.pickableSpells).toBe(component.pickableSpells);   // stable for the picker
      const el = renderModal();
      expect(el.querySelector('.always-prepared-gained .feature-name')?.textContent).toContain('Find Steed');
      expect(el.querySelector('.always-prepared-gained .feature-desc')?.textContent).toContain('From Faithful Steed.');

      component.selectedSpells = [aid];
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        newSpells: [
          jasmine.objectContaining({ lvl: 2, name: 'Aid', prepared: true }),
          jasmine.objectContaining({ lvl: 2, name: 'Find Steed', alwaysPrepared: true, grantedBy: 'Faithful Steed' }),
        ],
      });
    });

    it('hands over the spells of the oath picked at level 3, and swaps them when the pick changes', () => {
      const s = (name: string) => ({ ...cantrip(name), level: 1, classes: ['paladin'] });
      const all = [s('Bless'), s('Shield of Faith'), s('Protection from Evil and Good'), s('Bane'), s("Hunter's Mark")];
      dndResources.getSpells.and.returnValue(of(all));
      open({ level: 2, spells: [] }, {
        currentLevel: 2, newLevel: 3, fightingStyleDue: false, fightingStyleOptions: [],
        subclassDue: true, subclassOptions: oaths,
        currentSpellsKnown: 3, newSpellsKnown: 4, newSpellSlots: { 1: 3 },
        alwaysPreparedSpells: [],
        alwaysPreparedSpellsBySubclass: {
          'Oath of Devotion': [
            { name: 'Protection from Evil and Good', grantedBy: 'Oath of Devotion Spells' },
            { name: 'Shield of Faith', grantedBy: 'Oath of Devotion Spells' },
          ],
          'Oath of Vengeance': [
            { name: 'Bane', grantedBy: 'Oath of Vengeance Spells' },
            { name: "Hunter's Mark", grantedBy: 'Oath of Vengeance Spells' },
          ],
        },
      });
      dndResources.getSpellsForClass.and.returnValue(of(all.slice(0, 3)));
      component.ngOnInit();
      expect(dndResources.getSpells).toHaveBeenCalled();

      // No oath picked yet: nothing is handed over, and every class spell can be picked.
      expect(component.alwaysPreparedGrants).toEqual([]);
      expect(component.pickableSpells.map(x => x.name))
        .toEqual(['Bless', 'Shield of Faith', 'Protection from Evil and Good']);
      component.selectedSpells = [all[1]];   // the player picks Shield of Faith first

      component.selectedSubclass = 'Oath of Vengeance';
      expect(component.grantedSpells.map(g => g.spell.name)).toEqual(['Bane', "Hunter's Mark"]);

      component.selectedSubclass = 'Oath of Devotion';
      expect(component.grantedSpells.map(g => g.spell.name))
        .toEqual(['Protection from Evil and Good', 'Shield of Faith']);
      expect(component.pickableSpells.map(x => x.name)).toEqual(['Bless']);

      // An oath whose spells stay on the app's own table (Oath of the Holy) has no entry.
      component.selectedSubclass = 'Oath of the Holy';
      expect(component.alwaysPreparedGrants).toEqual([]);

      component.selectedSubclass = 'Oath of Devotion';
      component.confirm();
      // Shield of Faith was picked and is now granted: it is sent once, as the grant.
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        subclass: 'Oath of Devotion',
        newSpells: [
          jasmine.objectContaining({ name: 'Protection from Evil and Good', alwaysPrepared: true, grantedBy: 'Oath of Devotion Spells' }),
          jasmine.objectContaining({ name: 'Shield of Faith', alwaysPrepared: true, grantedBy: 'Oath of Devotion Spells' }),
        ],
      });
    });

    it('sends a granted spell even at a level with no picks, and nothing extra when the server names none', () => {
      const smite = { ...cantrip('Divine Smite'), level: 1, classes: ['paladin'] };
      dndResources.getSpells.and.returnValue(of([smite]));
      open({ spells: [] }, {
        fightingStyleDue: false, fightingStyleOptions: [],
        alwaysPreparedSpells: [{ name: 'Divine Smite', grantedBy: 'Divine Smite' }],
      });
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        newSpells: [jasmine.objectContaining({ name: 'Divine Smite', alwaysPrepared: true })],
      });

      pcService.levelUp.calls.reset();
      dndResources.getSpells.calls.reset();
      open({ spells: [] }, { fightingStyleDue: false, fightingStyleOptions: [] });
      expect(component.alwaysPreparedGrants).toEqual([]);
      expect(dndResources.getSpells).not.toHaveBeenCalled();
      component.submitting = false;
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
    });

    it('badges the server\'s recommendedFightingStyles, keeping only offered ones', () => {
      open({ specialization: 'Protection' }, { recommendedFightingStyles: ['Interception', 'Protection', 'Archery'] });
      expect(component.recommendedFightingStyles).toEqual(['Interception', 'Protection']);
      expect(component.isRecommendedFightingStyle('Protection')).toBeTrue();
      expect(component.isRecommendedFightingStyle('Defense')).toBeFalse();
      expect(component.selectedFightingStyle).toBe('');   // never pre-selected
    });

    it('falls back to the variant table when the field is absent, and follows a respec', () => {
      open({ specialization: 'Retribution' });
      expect(component.recommendedFightingStyles).toEqual(['Great Weapon Fighting']);
      component.selectedSpecialization = 'Holy';
      expect(component.recommendedFightingStyles).toEqual(['Blessed Warrior']);
      expect(component.recommendationSpecialization).toBe('Holy');
    });

    it('renders the "Recommended for <spec>" badge on the recommended style only', () => {
      open({ specialization: 'Holy' });
      const el = renderModal();
      const badged = Array.from(el.querySelectorAll('.subclass-option.is-recommended'))
        .map(n => n.querySelector('.feat-name')?.textContent?.trim());
      expect(badged).toEqual(['Blessed Warrior']);
      expect(el.querySelector('.subclass-option.is-recommended .recommended-badge')?.textContent)
        .toContain('Recommended for Holy');
    });

    it('recommends no styles for a Death Knight or a base paladin', () => {
      open({ subclass: 'Oath of the Ebon Blade', specialization: 'Blood' });
      expect(component.recommendedFightingStyles).toEqual([]);
      open({ specialization: null });
      expect(component.recommendedFightingStyles).toEqual([]);
    });

    it('tags Oath of the Holy as World of Warcraft and highlights it for Holy at level 3', () => {
      open({ level: 2 }, {
        currentLevel: 2, newLevel: 3, fightingStyleDue: false, fightingStyleOptions: [],
        subclassDue: true, subclassOptions: oaths,
      });
      expect(component.recommendedSubclass).toBe('Oath of the Holy');
      expect(component.subclassSourceTag('Oath of the Holy')).toBe('World of Warcraft');
      expect(component.subclassSourceTag('Oath of Devotion')).toBeUndefined();
      const tagged = Array.from(renderModal().querySelectorAll('.subclass-option'))
        .filter(n => n.querySelector('.source-tag'));
      expect(tagged.length).toBe(1);
      expect(tagged[0].textContent).toContain('Oath of the Holy');
      expect(tagged[0].querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
    });

    it('recommends Oath of Devotion for Protection and Oath of Vengeance for Retribution', () => {
      const lvl3 = { currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: oaths };
      open({ level: 2, specialization: 'Protection' }, lvl3);
      expect(component.recommendedSubclass).toBe('Oath of Devotion');
      open({ level: 2, specialization: 'Retribution' }, lvl3);
      expect(component.recommendedSubclass).toBe('Oath of Vengeance');
    });
  });

  describe('World of Warcraft Rogue (Swashbuckler, recommended subclass, respec)', () => {
    const subclasses = ['Arcane Trickster', 'Assassin', 'Soulknife', 'Swashbuckler', 'Thief'];

    function renderModal(): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Rogue', level: 2, specialization: 'Outlaw', ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: subclasses,
        recommendedFightingStyles: [], ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
      component.ngOnInit();
    }

    it('highlights the recommended subclass per specialization and allows a respec', () => {
      open({});
      expect(component.canRespec).toBeTrue();
      expect(component.recommendedSubclass).toBe('Swashbuckler');
      open({ specialization: 'Assassination' });
      expect(component.recommendedSubclass).toBe('Assassin');
      open({ specialization: 'Subtlety' });
      expect(component.recommendedSubclass).toBe('Soulknife');
      component.selectedSpecialization = 'Outlaw';
      expect(component.recommendedSubclass).toBe('Swashbuckler');
      expect(component.recommendedFightingStyles).toEqual([]);
    });

    it('prefers the server\'s recommendedSubclass while the specialization is unchanged', () => {
      open({}, { recommendedSubclass: 'Swashbuckler' });
      expect(component.recommendedSubclass).toBe('Swashbuckler');
      expect(component.selectedSubclass).toBeFalsy();   // never pre-selected
    });

    it('tags only Swashbuckler as World of Warcraft and badges it for Outlaw', () => {
      open({});
      expect(component.subclassSourceTag('Swashbuckler')).toBe('World of Warcraft');
      expect(component.subclassSourceTag('Thief')).toBeUndefined();
      const el = renderModal();
      const tagged = Array.from(el.querySelectorAll('.subclass-option')).filter(n => n.querySelector('.source-tag'));
      expect(tagged.length).toBe(1);
      expect(tagged[0].textContent).toContain('Swashbuckler');
      expect(tagged[0].querySelector('.source-tag')?.textContent).toContain('World of Warcraft');
      expect(el.querySelector('.subclass-option.is-recommended')?.textContent).toContain('Swashbuckler');
      expect(el.querySelector('.subclass-option.is-recommended .recommended-badge')?.textContent)
        .toContain('Recommended for Outlaw');
    });
  });

  describe('World of Warcraft Shaman (WoW paths, recommended path, respec)', () => {
    const paths = [
      'Path of the Berserker', 'Path of the Elements', 'Path of the Spiritual Guardian',
      'Path of the Wild Heart', 'Path of the World Tree', 'Path of the Zealot',
    ];

    function renderModal(): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Barbarian', level: 2, specialization: 'Elemental', ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: paths,
        recommendedFightingStyles: [], ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
      component.ngOnInit();
    }

    it('highlights the recommended path per specialization and allows a respec', () => {
      open({});
      expect(component.canRespec).toBeTrue();
      expect(component.recommendedSubclass).toBe('Path of the Elements');
      open({ specialization: 'Enhancement' });
      expect(component.recommendedSubclass).toBe('Path of the Spiritual Guardian');
      open({ specialization: 'Restoration' });
      expect(component.recommendedSubclass).toBe('Path of the World Tree');
      component.selectedSpecialization = 'Elemental';
      expect(component.recommendedSubclass).toBe('Path of the Elements');
      expect(component.recommendedFightingStyles).toEqual([]);
    });

    it('prefers the server\'s recommendedSubclass while the specialization is unchanged', () => {
      open({ specialization: 'Enhancement' }, { recommendedSubclass: 'Path of the Spiritual Guardian' });
      expect(component.recommendedSubclass).toBe('Path of the Spiritual Guardian');
      expect(component.selectedSubclass).toBeFalsy();   // never pre-selected
    });

    it('tags both WoW paths as World of Warcraft and badges the recommended one', () => {
      open({});
      expect(component.subclassSourceTag('Path of the Elements')).toBe('World of Warcraft');
      expect(component.subclassSourceTag('Path of the Spiritual Guardian')).toBe('World of Warcraft');
      expect(component.subclassSourceTag('Path of the World Tree')).toBeUndefined();
      const el = renderModal();
      const tagged = Array.from(el.querySelectorAll('.subclass-option')).filter(n => n.querySelector('.source-tag'));
      expect(tagged.map(n => n.textContent)).toEqual([
        jasmine.stringContaining('Path of the Elements'), jasmine.stringContaining('Path of the Spiritual Guardian'),
      ]);
      expect(el.querySelector('.subclass-option.is-recommended')?.textContent).toContain('Path of the Elements');
      expect(el.querySelector('.subclass-option.is-recommended .recommended-badge')?.textContent)
        .toContain('Recommended for Elemental');
    });
  });

  describe('World of Warcraft Warrior (recommended subclass, no fighting-style step, respec)', () => {
    const archetypes = ['Battle Master', 'Champion', 'Eldritch Knight', 'Psi Warrior'];

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Fighter', level: 2, specialization: 'Arms', ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: archetypes,
        fightingStyleDue: false, fightingStyleOptions: [], ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
      component.ngOnInit();
    }

    it('highlights the recommended subclass per specialization and allows a respec', () => {
      open({});
      expect(component.canRespec).toBeTrue();
      expect(component.recommendedSubclass).toBe('Battle Master');
      open({ specialization: 'Fury' });
      expect(component.recommendedSubclass).toBe('Champion');
      open({ specialization: 'Protection' });
      expect(component.recommendedSubclass).toBe('Battle Master');
      component.selectedSpecialization = 'Fury';
      expect(component.recommendedSubclass).toBe('Champion');
      expect(component.selectedSubclass).toBeFalsy();   // never pre-selected
    });

    it('never asks for a Fighting Style on level-up (it is a level-1 choice) and tags no WoW subclass', () => {
      open({ specialization: 'Protection' });
      expect(component.needsFightingStyle).toBeFalse();
      expect(component.recommendedFightingStyles).toEqual([]);
      for (const name of archetypes) {
        expect(component.subclassSourceTag(name)).toBeUndefined();
      }
    });
  });

  describe('World of Warcraft Priest (WoW domains, recommended domain, added spells, respec)', () => {
    const domains = [
      'Discipline Domain', 'Life Domain', 'Light Domain', 'Shadow Domain', 'Trickery Domain', 'Twilight Domain', 'War Domain',
    ];

    function renderModal(): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Cleric', level: 2, specialization: 'Shadow', spells: [], ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: domains,
        recommendedFightingStyles: [], ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
      component.ngOnInit();
    }

    it('highlights the recommended domain per specialization and allows a respec', () => {
      open({});
      expect(component.canRespec).toBeTrue();
      expect(component.recommendedSubclass).toBe('Shadow Domain');
      open({ specialization: 'Discipline' });
      expect(component.recommendedSubclass).toBe('Discipline Domain');
      open({ specialization: 'Holy' });
      expect(component.recommendedSubclass).toBe('Life Domain');
      component.selectedSpecialization = 'Shadow';
      expect(component.recommendedSubclass).toBe('Shadow Domain');
      expect(component.selectedSubclass).toBeFalsy();   // never pre-selected
    });

    it('tags both WoW domains as World of Warcraft and badges the recommended one', () => {
      open({ specialization: 'Discipline' }, { recommendedSubclass: 'Discipline Domain' });
      expect(component.subclassSourceTag('Discipline Domain')).toBe('World of Warcraft');
      expect(component.subclassSourceTag('Shadow Domain')).toBe('World of Warcraft');
      expect(component.subclassSourceTag('Life Domain')).toBeUndefined();
      const el = renderModal();
      const tagged = Array.from(el.querySelectorAll('.subclass-option')).filter(n => n.querySelector('.source-tag'));
      expect(tagged.map(n => n.textContent)).toEqual([
        jasmine.stringContaining('Discipline Domain'), jasmine.stringContaining('Shadow Domain'),
      ]);
      expect(el.querySelector('.subclass-option.is-recommended')?.textContent).toContain('Discipline Domain');
      expect(el.querySelector('.subclass-option.is-recommended .recommended-badge')?.textContent)
        .toContain('Recommended for Discipline');
    });

    it('loads the cleric list plus its added spells when a WoW priest learns spells, and the plain list for a base cleric', () => {
      const learn = { currentSpellsKnown: 5, newSpellsKnown: 6, newSpellSlots: { 1: 4, 2: 2 } };
      open({}, learn);
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('Cleric', WOW_PRIEST_EXTRA_SPELLS);
      dndResources.getSpellsForClass.calls.reset();
      open({ specialization: null, subclass: undefined }, learn);
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('Cleric');
      expect(dndResources.getSpellsForClass).not.toHaveBeenCalledWith('Cleric', jasmine.anything());
    });
  });

  describe('World of Warcraft Evoker (locked Draconic Sorcery, respec)', () => {
    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({
        clazz: 'Sorcerer', subclass: 'Draconic Sorcery', specialization: 'Devastation', level: 4, ...pc,
      });
      pcService.levelUpPreview.and.returnValue(of(makePreview({ currentLevel: 4, newLevel: 5, ...preview })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 5 })));
      component.ngOnInit();
    }

    it('offers the Evoker respec and no subclass (it is already locked)', () => {
      open({});
      expect(component.heroClass?.label).toBe('Evoker (Sorcerer)');
      expect(component.canRespec).toBeTrue();
      expect(component.heroClass?.specializations.map(s => s.name)).toEqual(['Augmentation', 'Devastation', 'Preservation']);
      expect(component.recommendedSubclass).toBeNull();
      component.selectedSpecialization = 'Preservation';
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, { specialization: 'Preservation' });
    });

    it('treats a Draconic Sorcery sorcerer without a specialization as a plain sorcerer', () => {
      open({ specialization: null });
      expect(component.heroClass).toBeUndefined();
      expect(component.canRespec).toBeFalse();
    });

    it('keeps Draconic Sorcery untagged (it is a base-game subclass)', () => {
      open({});
      expect(component.subclassSourceTag('Draconic Sorcery')).toBeUndefined();
    });
  });

  describe('World of Warcraft Hunter (recommended style at 2, subclass at 3, respec)', () => {
    const styles = ['Archery', 'Defense', 'Druidic Warrior', 'Great Weapon Fighting', 'Two-Weapon Fighting'];
    const subclasses = ['Beast Master', 'Fey Wanderer', 'Gloom Stalker', 'Hunter'];

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Ranger', specialization: 'Beast Mastery', level: 1, ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview(preview)));
      pcService.levelUp.and.returnValue(of(makePC({ level: 2 })));
      component.ngOnInit();
    }

    it('badges Archery for Beast Mastery and Marksmanship, Great Weapon Fighting for Survival', () => {
      const at2 = { currentLevel: 1, newLevel: 2, fightingStyleDue: true, fightingStyleOptions: styles };
      open({}, at2);
      expect(component.heroClass?.label).toBe('Hunter (Ranger)');
      expect(component.recommendedFightingStyles).toEqual(['Archery']);
      open({ specialization: 'Marksmanship' }, at2);
      expect(component.recommendedFightingStyles).toEqual(['Archery']);
      open({ specialization: 'Survival' }, at2);
      expect(component.recommendedFightingStyles).toEqual(['Great Weapon Fighting']);
      expect(component.selectedFightingStyle).toBeFalsy();   // never pre-selected
      // A respec this level follows the new specialization.
      component.selectedSpecialization = 'Beast Mastery';
      expect(component.recommendedFightingStyles).toEqual(['Archery']);
    });

    it("prefers the server's recommendedFightingStyles while the specialization is unchanged", () => {
      open({ specialization: 'Survival' }, {
        currentLevel: 1, newLevel: 2, fightingStyleDue: true, fightingStyleOptions: styles,
        recommendedFightingStyles: ['Great Weapon Fighting'],
      });
      expect(component.isRecommendedFightingStyle('Great Weapon Fighting')).toBeTrue();
      expect(component.isRecommendedFightingStyle('Archery')).toBeFalse();
    });

    it('badges Beast Master for Beast Mastery and Survival, Hunter for Marksmanship, at Ranger 3', () => {
      const at3 = { currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: subclasses };
      open({ level: 2 }, at3);
      expect(component.recommendedSubclass).toBe('Beast Master');
      open({ level: 2, specialization: 'Survival' }, at3);
      expect(component.recommendedSubclass).toBe('Beast Master');
      open({ level: 2, specialization: 'Marksmanship' }, at3);
      expect(component.recommendedSubclass).toBe('Hunter');
      expect(component.selectedSubclass).toBeFalsy();
      expect(component.subclassSourceTag('Beast Master')).toBeUndefined();
    });

    it('allows a respec and sends only the changed specialization', () => {
      open({ level: 5, subclass: 'Beast Master' }, { currentLevel: 5, newLevel: 6 });
      expect(component.canRespec).toBeTrue();
      component.selectedSpecialization = 'Survival';
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, { specialization: 'Survival' });
    });
  });
  describe('World of Warcraft Mage (Evoker school, WoW feats, added spells, respec)', () => {
    const schools = ['Abjurer', 'Diviner', 'Evoker', 'Illusionist'];

    function renderModal(feat = false): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      fixture.detectChanges();
      if (feat) {
        fixture.componentInstance.milestoneMode = 'feat';
        fixture.detectChanges();
      }
      return fixture.nativeElement as HTMLElement;
    }

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Wizard', level: 2, specialization: 'Frost', spells: [], ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: schools, ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
      component.ngOnInit();
    }

    it('badges the Evoker for every specialization and shows it as the school of evocation', () => {
      for (const specialization of ['Arcane', 'Fire', 'Frost']) {
        open({ specialization });
        expect(component.heroClass?.label).toBe('Mage (Wizard)');
        expect(component.recommendedSubclass).withContext(specialization).toBe('Evoker');
      }
      expect(component.canRespec).toBeTrue();
      expect(component.subclassOptionLabel('Evoker')).toBe('Evoker (school of evocation)');
      expect(component.subclassOptionLabel('Diviner')).toBe('Diviner');
      expect(component.subclassSourceTag('Evoker')).toBeUndefined();   // a base-game school
      const el = renderModal();
      const recommended = el.querySelector('.subclass-option.is-recommended') as HTMLElement;
      expect(recommended.textContent).toContain('Evoker (school of evocation)');
      expect(recommended.querySelector('.recommended-badge')?.textContent).toContain('Recommended for Frost');
      expect(el.querySelectorAll('.subclass-option .source-tag').length).toBe(0);
      expect(component.selectedSubclass).toBeFalsy();   // never pre-selected
    });

    it("keeps a base wizard's Evoker option unchanged", () => {
      open({ specialization: null });
      expect(component.heroClass).toBeUndefined();
      expect(component.subclassOptionLabel('Evoker')).toBe('Evoker');
    });

    it('tags the World of Warcraft feats in the feat picker, and no others', () => {
      open({ level: 3 }, {
        currentLevel: 3, newLevel: 4, subclassDue: false, subclassOptions: [], asiDue: true,
        featOptions: ['Alert', 'Clearcasting', 'Fingers of Frost', 'Hot Streak', 'War Caster'],
      });
      expect(component.featSourceTag('Clearcasting')).toBe('World of Warcraft');
      expect(component.featSourceTag('War Caster')).toBeUndefined();
      expect(component.featPrerequisite('Hot Streak')).toBeUndefined();
      const el = renderModal(true);
      const tagged = Array.from(el.querySelectorAll('.subclass-option'))
        .filter(n => n.querySelector('.feat-source-tag'))
        .map(n => n.querySelector('.feat-name')!.textContent!.trim());
      expect(tagged).toEqual(['Clearcasting', 'Fingers of Frost', 'Hot Streak']);
      expect(el.querySelector('.feat-source-tag')?.textContent).toContain('World of Warcraft');
      expect(el.querySelectorAll('.feat-prereq').length).toBe(0);
    });

    it('tags the Arcana Unleashed feats with their book and shows what each one needs', () => {
      open({ level: 3 }, {
        currentLevel: 3, newLevel: 4, subclassDue: false, subclassOptions: [], asiDue: true,
        featOptions: ['Alert', 'Clearcasting', 'Evocation Adept', 'Magic Connoisseur', 'Spell Resistant', 'Warlike Familiar'],
      });
      expect(component.featSourceTag('Evocation Adept')).toBe('Arcana Unleashed');
      expect(component.featSourceTag('Boon of Magic School Mastery (Evocation)')).toBe('Arcana Unleashed');
      expect(component.featPrerequisite('Evocation Adept')).toBe('Spellcasting or Pact Magic feature');
      expect(component.featPrerequisite('Boon of Magic School Mastery (Evocation)'))
        .toBe('Spellcasting or Pact Magic feature');
      expect(component.featPrerequisite('Spell Resistant')).toBeUndefined();
      const el = renderModal(true);
      const options = Array.from(el.querySelectorAll('.subclass-option')) as HTMLElement[];
      const row = (name: string) => options.find(n => n.querySelector('.feat-name')!.textContent!.trim() === name)!;
      const tagOf = (name: string) => row(name).querySelector('.feat-source-tag')?.textContent?.trim();
      const prereqOf = (name: string) => row(name).querySelector('.feat-prereq')?.textContent?.trim();
      expect(['Alert', 'Clearcasting', 'Evocation Adept', 'Magic Connoisseur', 'Spell Resistant', 'Warlike Familiar']
        .map(tagOf)).toEqual([undefined, 'World of Warcraft', 'Arcana Unleashed', 'Arcana Unleashed',
        'Arcana Unleashed', 'Arcana Unleashed']);
      expect(prereqOf('Evocation Adept')).toBe('Prerequisite: Spellcasting or Pact Magic feature');
      expect(prereqOf('Magic Connoisseur')).toBe('Prerequisite: Magic Initiate feat');
      expect(prereqOf('Warlike Familiar')).toBe('Prerequisite: Familiar Friend feat');
      expect(prereqOf('Spell Resistant')).toBeUndefined();
    });

    it('loads the wizard list plus its three added spells when a WoW mage learns spells, and the plain list otherwise', () => {
      const learn = { currentSpellsKnown: 5, newSpellsKnown: 6, newSpellSlots: { 1: 4, 2: 2 } };
      open({}, learn);
      expect(dndResources.getSpellsForClass)
        .toHaveBeenCalledWith('Wizard', ['Create Food and Water', 'Flame Strike', "Heroes' Feast"]);
      dndResources.getSpellsForClass.calls.reset();
      open({ specialization: null }, learn);
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('Wizard');
      expect(dndResources.getSpellsForClass).not.toHaveBeenCalledWith('Wizard', jasmine.anything());
    });
  });

  describe('World of Warcraft Monk (Warrior of Mystic Brews, DEX/WIS-gated feats, respec)', () => {
    const traditions = [
      'Warrior of Mercy', 'Warrior of Mystic Brews', 'Warrior of Shadow', 'Warrior of the Elements', 'Warrior of the Open Hand',
    ];

    function renderModal(feat = false): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      fixture.detectChanges();
      if (feat) {
        fixture.componentInstance.milestoneMode = 'feat';
        fixture.detectChanges();
      }
      return fixture.nativeElement as HTMLElement;
    }

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Monk', level: 2, specialization: 'Brewmaster', ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: traditions, ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 3 })));
      component.ngOnInit();
    }

    it('tags the Warrior of Mystic Brews World of Warcraft and badges it for Brewmaster', () => {
      open({}, { recommendedSubclass: 'Warrior of Mystic Brews' });
      expect(component.heroClass?.label).toBe('Monk');
      expect(component.canRespec).toBeTrue();
      expect(component.recommendedSubclass).toBe('Warrior of Mystic Brews');
      expect(component.subclassSourceTag('Warrior of Mystic Brews')).toBe('World of Warcraft');
      expect(component.subclassSourceTag('Warrior of Mercy')).toBeUndefined();
      const el = renderModal();
      const tagged = Array.from(el.querySelectorAll('.subclass-option')).filter(n => n.querySelector('.source-tag'));
      expect(tagged.map(n => n.textContent)).toEqual([jasmine.stringContaining('Warrior of Mystic Brews')]);
      expect(el.querySelector('.subclass-option.is-recommended')?.textContent).toContain('Warrior of Mystic Brews');
      expect(el.querySelector('.subclass-option.is-recommended .recommended-badge')?.textContent)
        .toContain('Recommended for Brewmaster');
      expect(component.selectedSubclass).toBeFalsy();
    });

    it('recommends Warrior of Mercy for Mistweaver and the Open Hand for Windwalker, following a respec', () => {
      open({ specialization: 'Mistweaver' });
      expect(component.recommendedSubclass).toBe('Warrior of Mercy');
      open({ specialization: 'Windwalker' });
      expect(component.recommendedSubclass).toBe('Warrior of the Open Hand');
      component.selectedSpecialization = 'Brewmaster';
      expect(component.recommendedSubclass).toBe('Warrior of Mystic Brews');
    });

    it('shows the monk feats the server offers with their DEX/WIS prerequisite and a World of Warcraft tag', () => {
      open({ level: 3, subclass: 'Warrior of Mystic Brews' }, {
        currentLevel: 3, newLevel: 4, subclassDue: false, subclassOptions: [], asiDue: true,
        featOptions: ['Clearcasting', 'Crusher', 'Elusive Brawler', 'Enveloping Mist', 'Fists of Fury', 'Stagger and Sway'],
      });
      expect(component.featPrerequisite('Elusive Brawler')).toBe('DEX 13+, WIS 13+');
      expect(component.featPrerequisite('Crusher')).toBeUndefined();
      const el = renderModal(true);
      const options = Array.from(el.querySelectorAll('.subclass-option')) as HTMLElement[];
      const nameOf = (n: HTMLElement) => n.querySelector('.feat-name')!.textContent!.trim();
      expect(options.filter(n => n.querySelector('.feat-source-tag')).map(nameOf))
        .toEqual(['Clearcasting', 'Elusive Brawler', 'Enveloping Mist', 'Fists of Fury', 'Stagger and Sway']);
      const prereqs = options.filter(n => n.querySelector('.feat-prereq'));
      expect(prereqs.map(nameOf)).toEqual(['Elusive Brawler', 'Enveloping Mist', 'Fists of Fury', 'Stagger and Sway']);
      expect(prereqs[0].querySelector('.feat-prereq')!.textContent).toContain('Prerequisite: DEX 13+, WIS 13+');
    });
  });

  describe('Arcana Unleashed feats: spells a feat gives, and spells picked for a feat', () => {
    const spell = (name: string, level: number, school: string, classes: string[]) => ({
      name, level, school, classes, actionType: 'action', concentration: false, ritual: false, range: 'Self',
      components: ['v'], duration: 'Instantaneous', description: `${name} text.`,
    }) as any;

    const mageHand = spell('Mage Hand', 0, 'conjuration', ['bard', 'wizard']);
    const rayOfFrost = spell('Ray of Frost', 0, 'evocation', ['sorcerer', 'wizard']);
    const fireBolt = spell('Fire Bolt', 0, 'evocation', ['sorcerer', 'wizard']);
    const guidance = spell('Guidance', 0, 'divination', ['cleric', 'druid']);
    const bless = spell('Bless', 1, 'enchantment', ['cleric', 'paladin']);
    const cureWounds = spell('Cure Wounds', 1, 'abjuration', ['cleric', 'druid']);
    const aid = spell('Aid', 2, 'abjuration', ['cleric', 'paladin']);
    const entangle = spell('Entangle', 1, 'conjuration', ['druid']);
    const moonbeam = spell('Moonbeam', 2, 'evocation', ['druid']);
    const magicMissile = spell('Magic Missile', 1, 'evocation', ['sorcerer', 'wizard']);
    const chromaticOrb = spell('Chromatic Orb', 1, 'evocation', ['sorcerer', 'wizard']);
    const guidingBolt = spell('Guiding Bolt', 1, 'evocation', ['cleric']);
    const shatter = spell('Shatter', 2, 'evocation', ['bard', 'sorcerer', 'wizard']);
    const fireball = spell('Fireball', 3, 'evocation', ['sorcerer', 'wizard']);
    const delayedBlast = spell('Delayed Blast Fireball', 7, 'evocation', ['sorcerer', 'wizard']);
    const sunburst = spell('Sunburst', 8, 'evocation', ['cleric', 'druid', 'sorcerer', 'wizard']);
    const shield = spell('Shield', 1, 'abjuration', ['sorcerer', 'wizard']);
    const battleFamiliar = spell('Battle Familiar', 2, 'transmutation', ['wizard']);
    const ALL = [mageHand, rayOfFrost, fireBolt, guidance, bless, cureWounds, aid, entangle, moonbeam, magicMissile,
      chromaticOrb, guidingBolt, shatter, fireball, delayedBlast, sunburst, shield, battleFamiliar];

    const namesOf = (spells: readonly { name: string }[]): string[] => spells.map(s => s.name);

    function renderModal(feat: string): { el: HTMLElement; modal: LevelUpModalComponent } {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      fixture.detectChanges();
      fixture.componentInstance.milestoneMode = 'feat';
      fixture.componentInstance.selectedFeat = feat;
      fixture.detectChanges();
      return { el: fixture.nativeElement as HTMLElement, modal: fixture.componentInstance };
    }

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Wizard', level: 3, spells: [], ...pc });
      pcService.levelUpPreview.and.returnValue(of(makePreview({
        currentLevel: 3, newLevel: 4, asiDue: true, newSpellSlots: { 1: 4, 2: 3 }, ...preview,
      })));
      pcService.levelUp.and.returnValue(of(makePC({ level: 4 })));
      dndResources.getSpells.and.returnValue(of(ALL));
      dndResources.getSpells.calls.reset();
      component.ngOnInit();
    }

    function takeFeat(feat: string): void {
      component.milestoneMode = 'feat';
      component.selectedFeat = feat;
    }

    // ── Spells a feat gives ───────────────────────────────────────────────────

    it('adds the spells of the feat being taken to what the level hands over', () => {
      const adept = [{ name: 'Chromatic Orb', grantedBy: 'Evocation Adept' }, { name: 'Shatter', grantedBy: 'Evocation Adept' }];
      open({ feat: 'Familiar Friend' }, {
        featOptions: ['Alert', 'Evocation Adept', 'Warlike Familiar'],
        alwaysPreparedSpells: [{ name: 'Shield', grantedBy: 'Some Feature' }],
        alwaysPreparedSpellsByFeat: {
          'Evocation Adept': adept,
          'Warlike Familiar': [{ name: 'Battle Familiar', grantedBy: 'Warlike Familiar' }],
        },
      });
      expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
      // Nothing of a feat's until it is the feat being taken.
      expect(namesOf(component.alwaysPreparedGrants)).toEqual(['Shield']);
      component.selectedFeat = 'Evocation Adept';
      expect(namesOf(component.alwaysPreparedGrants)).toEqual(['Shield']);   // still on Ability Scores
      takeFeat('Evocation Adept');
      expect(component.alwaysPreparedGrants).toEqual([{ name: 'Shield', grantedBy: 'Some Feature' }, ...adept]);
      expect(component.alwaysPreparedGrants).toBe(component.alwaysPreparedGrants);   // stable for the template
      expect(namesOf(component.grantedSpells.map(g => g.spell))).toEqual(['Shield', 'Chromatic Orb', 'Shatter']);
      expect(component.featChoices).toEqual([]);   // nothing to pick
      expect(component.canConfirm).toBeTrue();
      takeFeat('Warlike Familiar');
      expect(namesOf(component.alwaysPreparedGrants)).toEqual(['Shield', 'Battle Familiar']);
      takeFeat('Alert');
      expect(namesOf(component.alwaysPreparedGrants)).toEqual(['Shield']);

      takeFeat('Evocation Adept');
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        feat: 'Evocation Adept',
        newSpells: [
          jasmine.objectContaining({ name: 'Shield', alwaysPrepared: true, grantedBy: 'Some Feature' }),
          jasmine.objectContaining({ name: 'Chromatic Orb', lvl: 1, alwaysPrepared: true, grantedBy: 'Evocation Adept' }),
          jasmine.objectContaining({ name: 'Shatter', lvl: 2, alwaysPrepared: true, grantedBy: 'Evocation Adept' }),
        ],
      });
    });

    it('loads the spell data for a feat\'s spells even when nothing else is owed, and shows them', () => {
      open({}, {
        featOptions: ['Alert', 'Evocation Adept'],
        alwaysPreparedSpellsByFeat: { 'Evocation Adept': [{ name: 'Chromatic Orb', grantedBy: 'Evocation Adept' }] },
      });
      expect(dndResources.getSpells).toHaveBeenCalledTimes(1);
      const { el } = renderModal('Evocation Adept');
      expect(el.querySelector('.always-prepared-gained .feature-name')?.textContent).toContain('Chromatic Orb');
      expect(el.querySelector('.always-prepared-gained .feature-desc')?.textContent).toContain('From Evocation Adept.');
      expect(el.querySelectorAll('.feat-spell-pick').length).toBe(0);
    });

    it('does not send a spell twice when the player also picked it as a class spell', () => {
      open({}, {
        featOptions: ['Evocation Adept'], currentSpellsKnown: 6, newSpellsKnown: 7,
        alwaysPreparedSpellsByFeat: { 'Evocation Adept': [{ name: 'Chromatic Orb', grantedBy: 'Evocation Adept' }] },
      });
      component.selectedSpells = [chromaticOrb];   // picked before the feat was chosen
      takeFeat('Evocation Adept');
      component.confirm();
      const sent = pcService.levelUp.calls.mostRecent().args[1]!.newSpells!;
      expect(sent.map(s => [s.name, s.grantedBy])).toEqual([['Chromatic Orb', 'Evocation Adept']]);
    });

    // ── Arcane Warrior ────────────────────────────────────────────────────────

    it('makes Arcane Warrior pick two Wizard cantrips the character does not know', () => {
      open({ clazz: 'Fighter', spells: [{ lvl: 0, name: 'Fire Bolt', school: 'evocation', time: 'action', prepared: true }] },
        { featOptions: ['Alert', 'Arcane Warrior'], newSpellSlots: {} });
      expect(dndResources.getSpells).toHaveBeenCalledTimes(1);   // a feat on offer has spells to pick
      expect(component.featChoices).toEqual([]);                 // not taking it yet
      takeFeat('Arcane Warrior');
      const [choice] = component.featChoices;
      expect(component.featChoices).toBe(component.featChoices);
      expect([choice.label, choice.cantrips, choice.spells]).toEqual(['Arcane Warrior Cantrips', 2, 0]);
      expect(namesOf(component.featChoiceOptions(choice))).toEqual(['Mage Hand', 'Ray of Frost']);   // Fire Bolt is known
      expect(component.featChoiceOptions(choice)).toBe(component.featChoiceOptions(choice));           // stable for the picker
      expect(component.canConfirm).toBeFalse();
      component.setFeatPicks(choice, [mageHand]);
      expect(component.canConfirm).toBeFalse();
      component.setFeatPicks(choice, [mageHand, rayOfFrost]);
      expect(component.featChoicesSatisfied).toBeTrue();
      expect(component.canConfirm).toBeTrue();

      component.confirm();
      const [, choices] = pcService.levelUp.calls.mostRecent().args;
      expect(choices!.feat).toBe('Arcane Warrior');
      expect(choices!.newSpells!.map(s => [s.name, s.lvl, s.grantedBy, !!s.alwaysPrepared])).toEqual([
        ['Mage Hand', 0, 'Arcane Warrior', false], ['Ray of Frost', 0, 'Arcane Warrior', false],
      ]);
    });

    it('drops the picks from the commit when the player goes back to Ability Scores or another feat', () => {
      open({ clazz: 'Fighter' }, { featOptions: ['Alert', 'Arcane Warrior'], newSpellSlots: {} });
      takeFeat('Arcane Warrior');
      component.setFeatPicks(component.featChoices[0], [mageHand, rayOfFrost]);
      takeFeat('Alert');
      expect(component.featChoices).toEqual([]);
      expect(component.canConfirm).toBeTrue();
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, { feat: 'Alert' });
    });

    it('renders the picker for the feat being taken, with its count and hint', () => {
      open({ clazz: 'Fighter' }, { featOptions: ['Alert', 'Arcane Warrior'], newSpellSlots: {} });
      const { el, modal } = renderModal('Arcane Warrior');
      const picks = Array.from(el.querySelectorAll('.feat-spell-pick')) as HTMLElement[];
      expect(picks.length).toBe(1);
      expect(picks[0].querySelector('.spell-label')!.textContent).toContain('Arcane Warrior Cantrips');
      expect(picks[0].querySelector('.spell-counts')!.textContent).toContain('0/2');
      expect(picks[0].querySelector('.style-cantrip-hint')!.textContent).toContain('Pick two Wizard cantrips.');
      expect(Array.from(picks[0].querySelectorAll('.spell-name')).map(n => n.textContent!.trim()))
        .toEqual(['Mage Hand', 'Ray of Frost', 'Fire Bolt']);
      expect(modal.canConfirm).toBeFalse();
      expect(renderModal('Alert').el.querySelectorAll('.feat-spell-pick').length).toBe(0);
    });

    it('teaches Arcane Warrior\'s cantrips through the Fighting Style choice too', () => {
      open({ clazz: 'Paladin', level: 1 }, {
        currentLevel: 1, newLevel: 2, asiDue: false, fightingStyleDue: true,
        fightingStyleOptions: ['Arcane Warrior', 'Archery', 'Blessed Warrior'], newSpellSlots: { 1: 2 },
      });
      dndResources.getSpellsForClass.and.returnValue(of([mageHand, rayOfFrost, fireBolt, shield]));
      component.selectFightingStyle('Arcane Warrior');
      expect(dndResources.getSpellsForClass).toHaveBeenCalledWith('wizard');
      expect(component.cantripStyle?.count).toBe(2);
      expect(namesOf(component.styleCantripOptions)).toEqual(['Mage Hand', 'Ray of Frost', 'Fire Bolt']);
      expect(component.canConfirm).toBeFalse();
      component.styleCantrips = [mageHand, rayOfFrost];
      expect(component.canConfirm).toBeTrue();
      component.confirm();
      expect(pcService.levelUp).toHaveBeenCalledWith(7, {
        fightingStyle: 'Arcane Warrior',
        newSpells: [jasmine.objectContaining({ lvl: 0, name: 'Mage Hand' }), jasmine.objectContaining({ lvl: 0, name: 'Ray of Frost' })],
      });
    });

    // ── Magic Connoisseur ─────────────────────────────────────────────────────

    it('makes Magic Connoisseur pick a level 1 and a level 2 spell from the Magic Initiate class list', () => {
      open({ clazz: 'Fighter', feat: 'Magic Initiate (Cleric)' }, { featOptions: ['Magic Connoisseur'], newSpellSlots: {} });
      takeFeat('Magic Connoisseur');
      expect(component.needsConnoisseurList).toBeFalse();
      expect(component.connoisseurSpellList).toBe('cleric');
      const [first, second] = component.featChoices;
      expect(namesOf(component.featChoiceOptions(first))).toEqual(['Bless', 'Cure Wounds', 'Guiding Bolt']);
      expect(namesOf(component.featChoiceOptions(second))).toEqual(['Aid']);
      component.setFeatPicks(first, [bless]);
      expect(component.canConfirm).toBeFalse();
      component.setFeatPicks(second, [aid]);
      expect(component.canConfirm).toBeTrue();

      component.confirm();
      const sent = pcService.levelUp.calls.mostRecent().args[1]!;
      expect(sent.feat).toBe('Magic Connoisseur');
      expect(sent.newSpells!.map(s => [s.name, s.lvl, s.alwaysPrepared, s.grantedBy])).toEqual([
        ['Bless', 1, true, 'Magic Connoisseur'], ['Aid', 2, true, 'Magic Connoisseur'],
      ]);
    });

    it('asks which class list when the character has two Magic Initiate feats', () => {
      open({
        clazz: 'Fighter', feat: 'Magic Initiate (Cleric)',
        features: [{ name: 'Magic Initiate (Druid)', source: 'Human (World of Warcraft) · Origin Feat', desc: '' }],
      }, { featOptions: ['Alert', 'Magic Connoisseur'], newSpellSlots: {} });
      takeFeat('Alert');
      expect(component.needsConnoisseurList).toBeFalse();
      takeFeat('Magic Connoisseur');
      expect(component.needsConnoisseurList).toBeTrue();
      expect(component.magicInitiateOptions.map(o => o.className)).toEqual(['Cleric', 'Druid']);
      expect(component.magicInitiateOptions).toBe(component.magicInitiateOptions);
      component.setFeatPicks(component.featChoices[0], [bless]);

      component.connoisseurList = 'druid';
      const [first, second] = component.featChoices;
      expect(namesOf(component.featChoiceOptions(first))).toEqual(['Cure Wounds', 'Entangle']);
      expect(namesOf(component.featChoiceOptions(second))).toEqual(['Moonbeam']);
      expect(component.featPicksFor(first)).toEqual([]);   // the Cleric pick does not carry over
      expect(component.canConfirm).toBeFalse();

      const { el } = renderModal('Magic Connoisseur');
      expect(Array.from(el.querySelectorAll('#level-up-connoisseur-list option')).map(o => o.textContent!.trim()))
        .toEqual(['Cleric', 'Druid']);
      expect(el.querySelectorAll('.feat-spell-pick').length).toBe(2);
    });

    // ── Boon of Magic School Mastery ──────────────────────────────────────────

    it('makes a Boon of Magic School Mastery pick a level 1 class spell and a spell of level 7 or lower, of its school', () => {
      const boon = 'Boon of Magic School Mastery (Evocation)';
      open({
        level: 18,
        spells: [
          { lvl: 1, name: 'Magic Missile', school: 'evocation', time: 'action', prepared: true },
          { lvl: 3, name: 'Fireball', school: 'evocation', time: 'action', prepared: true, alwaysPrepared: true, grantedBy: 'Evocation Adept' },
        ],
      }, { currentLevel: 18, newLevel: 19, featOptions: [boon, 'Boon of Fate'] });
      takeFeat(boon);
      const [rote, signature] = component.featChoices;
      expect([rote.label, signature.label]).toEqual(['Rote Casting', 'Signature Arcanum']);
      // Level 1 Evocation spells on the Wizard list; one the wizard merely knows stays on offer.
      expect(namesOf(component.featChoiceOptions(rote))).toEqual(['Magic Missile', 'Chromatic Orb']);
      // Any list, level 1 to 7; a spell already always prepared is left out.
      expect(namesOf(component.featChoiceOptions(signature)))
        .toEqual(['Moonbeam', 'Magic Missile', 'Chromatic Orb', 'Guiding Bolt', 'Shatter', 'Delayed Blast Fireball']);
      component.setFeatPicks(rote, [magicMissile]);
      // A spell picked for one choice is not offered for the other.
      expect(namesOf(component.featChoiceOptions(signature)))
        .toEqual(['Moonbeam', 'Chromatic Orb', 'Guiding Bolt', 'Shatter', 'Delayed Blast Fireball']);
      expect(component.canConfirm).toBeFalse();
      component.setFeatPicks(signature, [delayedBlast]);
      expect(component.canConfirm).toBeTrue();

      component.confirm();
      const sent = pcService.levelUp.calls.mostRecent().args[1]!;
      expect(sent.feat).toBe(boon);
      expect(sent.newSpells!.map(s => [s.name, s.lvl, s.school, s.alwaysPrepared, s.grantedBy])).toEqual([
        ['Magic Missile', 1, 'evocation', true, boon], ['Delayed Blast Fireball', 7, 'evocation', true, boon],
      ]);
    });

    it('says so when a choice has no spell to offer, and keeps the level-up blocked', () => {
      const boon = 'Boon of Magic School Mastery (Transmutation)';
      open({ level: 18 }, { currentLevel: 18, newLevel: 19, featOptions: [boon] });
      takeFeat(boon);
      const [rote, signature] = component.featChoices;
      expect(component.featChoiceOptions(rote)).toEqual([]);          // no level 1 Transmutation spell in this data
      expect(component.featChoiceEmpty(rote)).toBeTrue();
      expect(namesOf(component.featChoiceOptions(signature))).toEqual(['Battle Familiar']);
      expect(component.featChoiceEmpty(signature)).toBeFalse();
      expect(component.canConfirm).toBeFalse();
      const { el } = renderModal(boon);
      expect(el.querySelector('.feat-spell-pick [role="status"]')?.textContent)
        .toContain('No spell fits this pick. Choose a different feat.');
    });

    it('says so when the spell data did not load', () => {
      open({ clazz: 'Fighter' }, { featOptions: ['Arcane Warrior'], newSpellSlots: {} });
      dndResources.getSpells.and.returnValue(throwError(() => new Error('offline')));
      component.ngOnInit();
      takeFeat('Arcane Warrior');
      expect(component.spellDataFailed).toBeTrue();
      expect(component.featChoiceOptions(component.featChoices[0])).toEqual([]);
      expect(component.featChoiceEmpty(component.featChoices[0])).toBeFalse();   // unknown, not empty
      expect(component.canConfirm).toBeFalse();
      const { el } = renderModal('Arcane Warrior');
      expect(el.querySelector('.feat-spell-pick [role="status"]')?.textContent).toContain('The spell list did not load.');
    });

    it('does not load the spell data when no feat on offer has spells', () => {
      open({ clazz: 'Fighter' }, { featOptions: ['Alert', 'Spell Resistant'], newSpellSlots: {} });
      expect(dndResources.getSpells).not.toHaveBeenCalled();
      takeFeat('Spell Resistant');
      expect(component.featChoices).toEqual([]);
      expect(component.canConfirm).toBeTrue();
    });
  });

  describe('Arcana Unleashed subclasses', () => {
    const CLERIC = ['Arcana Domain', 'Discipline Domain', 'Life Domain', 'Light Domain', 'Shadow Domain', 'War Domain'];
    const WIZARD = ['Abjurer', 'Conjurer', 'Diviner', 'Enchanter', 'Evoker', 'Illusionist', 'Necromancer', 'Transmuter'];
    const spell = (name: string, level: number, classes: string[] = ['wizard']): DndSpell => ({
      name, level, school: 'evocation', classes, actionType: 'action', concentration: false, ritual: false,
      range: '60 feet', components: ['v', 's'], duration: 'Instantaneous', description: '',
    });
    const SPELLS = [
      spell('Light', 0, ['cleric', 'wizard']), spell('Mage Hand', 0), spell('Fire Bolt', 0), spell('Guidance', 0, ['cleric']),
      spell('Bless', 1, ['cleric']),
      spell('Disintegrate', 6), spell('Teleport', 7), spell('Maze', 8), spell('Wish', 9),
      spell('Druidcraft', 0, ['druid']), spell('Prestidigitation', 0, ['bard']),
    ];
    const granted = (name: string, lvl: number, grantedBy: string) =>
      ({ name, lvl, school: 'evocation', time: 'action', prepared: true, grantedBy, ...(lvl > 0 ? { alwaysPrepared: true } : {}) });
    const result = (over: Partial<SubclassChoiceResult> = {}): SubclassChoiceResult =>
      ({ subclassChoices: {}, newSpells: [], forgetSpells: [], valid: true, ...over });

    function open(pc: Partial<PC>, preview: Partial<LevelUpPreview> = {}): void {
      component.pc = makePC({ clazz: 'Cleric', level: 2, ...pc });
      component.selectedSubclass = null;
      component.submitting = false;
      const level = component.pc.level ?? 1;
      pcService.levelUpPreview.and.returnValue(of(makePreview({ currentLevel: level, newLevel: level + 1, ...preview })));
      pcService.levelUp.and.returnValue(of(makePC({ level: level + 1 })));
      dndResources.getSpells.and.returnValue(of(SPELLS));
      component.ngOnInit();
    }

    /** Render the real template (and the subclass-choices child) against the same spies. */
    function renderModal() {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PCService, useValue: pcService },
          { provide: DndResourcesService, useValue: dndResources },
        ],
      });
      const fixture = TestBed.createComponent(LevelUpModalComponent);
      fixture.componentInstance.pc = component.pc;
      const refresh = () => { fixture.detectChanges(); fixture.detectChanges(); };
      refresh();
      const el = fixture.nativeElement as HTMLElement;
      const rows = () => (Array.from(el.querySelectorAll('.subclass-option')) as HTMLElement[])
        .filter(row => !!row.querySelector('input[name="subclass"]'));
      const click = (root: ParentNode, selector: string, text: string) => {
        const row = (Array.from(root.querySelectorAll(selector)) as HTMLElement[])
          .find(n => n.textContent!.replace(/\s+/g, ' ').trim().startsWith(text))!;
        (row.querySelector('input') as HTMLInputElement).click();
        refresh();
      };
      return { fixture, modal: fixture.componentInstance, el, rows, click, refresh };
    }

    describe('source tag and filter', () => {
      it('tags the eight Arcana Unleashed, beside the World of Warcraft and untagged base-game ones', () => {
        expect(component.subclassSourceTag('Arcana Domain')).toBe('Arcana Unleashed');
        for (const name of ['Arcane Archer', 'Warrior of the Mystic Arts', 'Vestige Patron', 'Conjurer', 'Enchanter',
          'Necromancer', 'Transmuter']) {
          expect(component.subclassSourceTag(name)).withContext(name).toBe('Arcana Unleashed');
        }
        expect(component.subclassSourceTag('Shadow Domain')).toBe('World of Warcraft');
        expect(component.subclassSourceTag('Life Domain')).toBeUndefined();
      });

      it('lists every option by default and hides a book\'s subclasses when it is switched off', () => {
        open({ specialization: 'Shadow' }, { subclassDue: true, subclassOptions: CLERIC });
        expect(component.visibleSubclassOptions).toEqual(CLERIC);
        expect(component.visibleSubclassOptions).toBe(component.visibleSubclassOptions);   // stable for the template

        component.toggleSubclassSource('Arcana Unleashed');
        expect(component.visibleSubclassOptions).toEqual(['Discipline Domain', 'Life Domain', 'Light Domain', 'Shadow Domain', 'War Domain']);
        component.toggleSubclassSource('World of Warcraft');
        expect(component.visibleSubclassOptions).toEqual(['Life Domain', 'Light Domain', 'War Domain']);
        component.toggleSubclassSource('Base Game');
        expect(component.visibleSubclassOptions).toEqual([]);
        component.toggleSubclassSource('Arcana Unleashed');
        expect(component.visibleSubclassOptions).toEqual(['Arcana Domain']);
      });

      it('hides all four Wizard schools at once, and nothing else', () => {
        open({ clazz: 'Wizard' }, { subclassDue: true, subclassOptions: WIZARD });
        component.toggleSubclassSource('Arcana Unleashed');
        expect(component.visibleSubclassOptions).toEqual(['Abjurer', 'Diviner', 'Evoker', 'Illusionist']);
      });

      it('keeps the subclass already picked in the list when its book is switched off', () => {
        open({}, { subclassDue: true, subclassOptions: CLERIC });
        component.selectedSubclass = 'Arcana Domain';
        component.toggleSubclassSource('Arcana Unleashed');
        expect(component.visibleSubclassOptions).toContain('Arcana Domain');
        expect(component.selectedSubclass).toBe('Arcana Domain');
        component.selectedSubclass = 'Life Domain';
        expect(component.visibleSubclassOptions).not.toContain('Arcana Domain');
      });

      it('renders the three checkboxes over the picker, the tag on the row, and hides the row when unticked', () => {
        open({ specialization: 'Shadow' }, { subclassDue: true, subclassOptions: CLERIC });
        const { el, rows, refresh } = renderModal();
        const boxes = Array.from(el.querySelectorAll('.subclass-pick .source-filter-option')) as HTMLElement[];
        expect(boxes.map(b => b.textContent!.trim())).toEqual(['Base Game', 'World of Warcraft', 'Arcana Unleashed']);
        expect(boxes.every(b => (b.querySelector('input') as HTMLInputElement).checked)).toBeTrue();
        const tags = () => rows().map(r => [r.querySelector('span')!.textContent!.trim(), r.querySelector('.source-tag')?.textContent?.trim() ?? '']);
        expect(tags()).toEqual([
          ['Arcana Domain', 'Arcana Unleashed'], ['Discipline Domain', 'World of Warcraft'], ['Life Domain', ''],
          ['Light Domain', ''], ['Shadow Domain', 'World of Warcraft'], ['War Domain', ''],
        ]);

        (boxes[2].querySelector('input') as HTMLInputElement).click();
        refresh();
        expect(tags().map(t => t[0])).toEqual(['Discipline Domain', 'Life Domain', 'Light Domain', 'Shadow Domain', 'War Domain']);
        expect(el.querySelector('.subclass-pick [role="status"]')).toBeNull();
        (boxes[0].querySelector('input') as HTMLInputElement).click();
        (boxes[1].querySelector('input') as HTMLInputElement).click();
        refresh();
        expect(rows().length).toBe(0);
        expect(el.querySelector('.subclass-pick [role="status"]')!.textContent)
          .toContain('No subclasses to show. Turn on a content source above.');
        (boxes[2].querySelector('input') as HTMLInputElement).click();
        refresh();
        expect(tags()).toEqual([['Arcana Domain', 'Arcana Unleashed']]);
      });

      it('offers a World of Warcraft Mage the four schools under their own names, Evoker still relabelled', () => {
        open({ clazz: 'Wizard', specialization: 'Frost' }, { subclassDue: true, subclassOptions: WIZARD, recommendedSubclass: 'Evoker' });
        expect(component.heroClass?.name).toBe('Mage');
        expect(component.visibleSubclassOptions).toEqual(WIZARD);
        expect(WIZARD.map(name => component.subclassOptionLabel(name))).toEqual([
          'Abjurer', 'Conjurer', 'Diviner', 'Enchanter', 'Evoker (school of evocation)', 'Illusionist', 'Necromancer',
          'Transmuter',
        ]);
        expect(component.recommendedSubclass).toBe('Evoker');
        component.selectedSubclass = 'Necromancer';
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, { subclass: 'Necromancer' });
      });
    });

    describe('picking a subclass with nothing more to choose', () => {
      it('confirms a Warrior of the Mystic Arts and a Conjurer the same way', () => {
        for (const [clazz, subclass] of [['Monk', 'Warrior of the Mystic Arts'], ['Wizard', 'Conjurer']]) {
          pcService.levelUp.calls.reset();
          open({ clazz }, { subclassDue: true, subclassOptions: [subclass, 'Other'] });
          expect(component.canConfirm).withContext(subclass).toBeFalse();   // a subclass is due
          component.selectedSubclass = subclass;
          expect(component.canConfirm).withContext(subclass).toBeTrue();
          component.confirm();
          expect(pcService.levelUp).withContext(subclass).toHaveBeenCalledWith(7, { subclass });
        }
      });

      it('holds a Vestige Patron picked at level 3 until its type and domain are chosen', () => {
        open({ clazz: 'Warlock' }, { subclassDue: true, subclassOptions: ['Vestige Patron', 'Other'] });
        component.selectedSubclass = 'Vestige Patron';
        expect(component.subclassChoicesSatisfied).toBeFalse();
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { vestigeType: 'Fiend' }, valid: false }));
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' } }));
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7,
          { subclass: 'Vestige Patron', subclassChoices: { vestigeType: 'Fiend', vestigeDomain: 'War' } });
      });

      it('levels a Vestige Patron, an Arcane Archer and a Transmuter on with no extra fields', () => {
        for (const pc of [
          { clazz: 'Warlock', subclass: 'Vestige Patron', level: 5,
            subclassChoices: { vestigeType: 'Fiend' as const, vestigeDomain: 'War' as const } },
          {
            clazz: 'Fighter', subclass: 'Arcane Archer', level: 4,
            subclassChoices: { skills: [], arcaneShots: ['Seeking Shot', 'Shadow Shot'] },
            spells: [granted('Druidcraft', 0, 'Arcane Archer Lore')],
          },
          { clazz: 'Wizard', subclass: 'Transmuter', level: 9 },
        ]) {
          pcService.levelUp.calls.reset();
          open(pc);
          expect(component.effectiveSubclass).toBe(pc.subclass);
          expect(component.canConfirm).withContext(pc.subclass).toBeTrue();
          component.confirm();
          expect(pcService.levelUp).withContext(pc.subclass).toHaveBeenCalledWith(7, {});
        }
      });
    });

    describe('Arcane Archer replacement skills', () => {
      it('blocks Confirm until the one replacement is chosen, then sends it', () => {
        open({ clazz: 'Fighter', skills: { Nature: 'prof' } }, { subclassDue: true, subclassOptions: ['Arcane Archer', 'Champion'] });
        component.selectedSubclass = 'Arcane Archer';
        expect(component.subclassChoicesSatisfied).toBeFalse();
        expect(component.canConfirm).toBeFalse();
        component.confirm();
        expect(pcService.levelUp).not.toHaveBeenCalled();

        component.onSubclassChoices(result({ subclassChoices: { skills: ['Insight'] } }));
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, { subclass: 'Arcane Archer', subclassChoices: { skills: ['Insight'] } });
      });

      it('asks for two when the fighter had both, and stays blocked on an incomplete answer', () => {
        open({ clazz: 'Fighter', skills: { Nature: 'prof', Arcana: 'expert' } },
          { subclassDue: true, subclassOptions: ['Arcane Archer', 'Champion'] });
        component.selectedSubclass = 'Arcane Archer';
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { skills: ['Insight'] }, valid: false }));
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { skills: ['Insight', 'Survival'] } }));
        expect(component.canConfirm).toBeTrue();
      });

      it('forgets the answer when another subclass is picked instead', () => {
        open({ clazz: 'Fighter', skills: { Nature: 'prof' } }, { subclassDue: true, subclassOptions: ['Arcane Archer', 'Champion'] });
        component.selectedSubclass = 'Arcane Archer';
        component.onSubclassChoices(result({ subclassChoices: { skills: ['Insight'] } }));
        component.selectedSubclass = 'Champion';
        expect(component.subclassChoiceResult).toBeNull();
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, { subclass: 'Champion' });
      });

      it('works through the rendered dialog: the granted skills, the pick, and Confirm still waits for the rest', () => {
        open({ clazz: 'Fighter', skills: { Nature: 'prof' } }, { subclassDue: true, subclassOptions: ['Arcane Archer', 'Champion'] });
        const { el, modal, click } = renderModal();
        const confirmButton = () => el.querySelector('.modal-actions .btn.primary') as HTMLButtonElement;
        expect(el.querySelector('app-subclass-choices')!.children.length).toBe(0);
        click(el, '.subclass-option', 'Arcane Archer');
        expect(Array.from(el.querySelectorAll('app-subclass-choices .granted-skills .feature-item')).map(n => n.textContent!.trim()))
          .toEqual(['ArcanaGained', 'NatureAlready proficient']);
        expect(confirmButton().disabled).toBeTrue();
        click(el, 'app-subclass-choices .skill-pick .subclass-option', 'Survival');
        // The skill alone is not enough: two Arcane Shot options and the Lore cantrip are owed too.
        expect(confirmButton().disabled).toBeTrue();
        modal.confirm();
        expect(pcService.levelUp).not.toHaveBeenCalled();
      });
    });

    describe('Arcane Archer options and Lore cantrip', () => {
      const FIGHTER_OPTIONS = { subclassDue: true, subclassOptions: ['Arcane Archer', 'Battle Master', 'Champion'] };
      const TWO = ['Seeking Shot', 'Shadow Shot'];
      const lore = granted('Druidcraft', 0, 'Arcane Archer Lore');
      const archer = (level: number, arcaneShots: string[]): Partial<PC> => ({
        clazz: 'Fighter', subclass: 'Arcane Archer', level, skills: { Arcana: 'prof', Nature: 'prof' },
        subclassChoices: { skills: [], arcaneShots }, spells: [lore],
      });
      const optionNames = (el: HTMLElement, selector = '.shot-option') =>
        Array.from(el.querySelectorAll(`app-arcane-shot-picker ${selector} .shot-name`)).map(n => n.textContent!.trim());

      it('blocks Confirm for an Arcane Archer reaching Fighter 3 until its options and cantrip are chosen', () => {
        open({ clazz: 'Fighter', skills: { Athletics: 'prof' } }, FIGHTER_OPTIONS);
        expect(component.canConfirm).toBeFalse();   // a subclass is due
        component.selectedSubclass = 'Champion';
        expect(component.canConfirm).toBeTrue();
        component.selectedSubclass = 'Arcane Archer';
        expect(component.effectiveSubclass).toBe('Arcane Archer');
        expect(component.subclassChoicesSatisfied).toBeFalse();
        expect(component.canConfirm).toBeFalse();
        component.confirm();
        expect(pcService.levelUp).not.toHaveBeenCalled();

        component.onSubclassChoices(result({ subclassChoices: { arcaneShots: ['Seeking Shot'] }, valid: false }));
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { arcaneShots: TWO }, newSpells: [lore] }));
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, {
          subclass: 'Arcane Archer', subclassChoices: { arcaneShots: TWO }, newSpells: [lore],
        });
      });

      it('asks nothing at a level that adds no option, and waits for one more at Fighter 7', () => {
        for (const level of [3, 4, 5]) {
          open(archer(level, TWO));
          expect(component.subclassChoicesSatisfied).withContext(`to ${level + 1}`).toBeTrue();
          expect(component.canConfirm).withContext(`to ${level + 1}`).toBeTrue();
        }
        open(archer(6, TWO));
        expect(component.subclassChoicesSatisfied).toBeFalse();
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { arcaneShots: [...TWO, 'Piercing Shot'] } }));
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, { subclassChoices: { arcaneShots: [...TWO, 'Piercing Shot'] } });
      });

      it('waits for an archer made by hand to catch up, at whatever level it is', () => {
        open({ clazz: 'Fighter', subclass: 'Arcane Archer', level: 8, skills: { Arcana: 'prof', Nature: 'prof' } });
        expect(component.canConfirm).toBeFalse();
        // Complete options but no cantrip: the dialog trusts only what the section reports.
        open({ ...archer(8, [...TWO, 'Piercing Shot']), spells: [] });
        expect(component.canConfirm).toBeFalse();
        open(archer(8, [...TWO, 'Piercing Shot']));
        expect(component.canConfirm).toBeTrue();
      });

      it('works through the rendered dialog at Fighter 3: two options, the cantrip, then Confirm', () => {
        open({ clazz: 'Fighter', skills: { Athletics: 'prof' } }, FIGHTER_OPTIONS);
        const { el, modal, click } = renderModal();
        const confirmButton = () => el.querySelector('.modal-actions .btn.primary') as HTMLButtonElement;
        expect(el.querySelector('app-arcane-shot-choice')).toBeNull();
        click(el, '.subclass-option', 'Arcane Archer');

        expect(el.querySelector('app-arcane-shot-choice .shot-label')!.textContent!.replace(/\s+/g, ' ').trim())
          .toBe('Arcane Shot options 0/2');
        expect(optionNames(el).length).toBe(8);
        expect(el.querySelector('app-arcane-shot-choice .shot-replace')).toBeNull();   // nothing to replace yet
        expect(confirmButton().disabled).toBeTrue();

        click(el, 'app-arcane-shot-picker .shot-option', 'Seeking Shot');
        click(el, 'app-arcane-shot-picker .shot-option', 'Shadow Shot');
        expect(optionNames(el, '.shot-option.is-selected')).toEqual(['Seeking Shot', 'Shadow Shot']);
        expect(confirmButton().disabled).toBeTrue();   // the cantrip is still owed

        const picker = el.querySelector('app-subclass-choices .subclass-spell-pick') as HTMLElement;
        expect(picker.querySelector('.spell-label')!.textContent).toContain('Arcane Archer Lore cantrip');
        expect(Array.from(picker.querySelectorAll('.spell-name')).map(n => n.textContent!.trim()))
          .toEqual(['Druidcraft', 'Prestidigitation']);
        click(picker, '.spell-option', 'Prestidigitation');
        expect(confirmButton().disabled).toBeFalse();

        modal.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, {
          subclass: 'Arcane Archer',
          subclassChoices: { arcaneShots: ['Seeking Shot', 'Shadow Shot'] },
          newSpells: [jasmine.objectContaining({ name: 'Prestidigitation', lvl: 0, grantedBy: 'Arcane Archer Lore', prepared: true })],
        });
        // Picking another subclass takes the whole answer back.
        click(el, '.subclass-option', 'Champion');
        expect(el.querySelector('app-arcane-shot-choice')).toBeNull();
        expect(modal.subclassChoiceResult).toBeNull();
      });

      it('works through the rendered dialog at Fighter 7: one more option, with one known option replaced', () => {
        open(archer(6, TWO));
        const { el, modal, click, refresh } = renderModal();
        const confirmButton = () => el.querySelector('.modal-actions .btn.primary') as HTMLButtonElement;
        expect(el.querySelector('app-arcane-shot-choice .shot-label')!.textContent!.replace(/\s+/g, ' ').trim())
          .toBe('Arcane Shot options 2/3');
        expect(optionNames(el, '.shot-option.is-selected')).toEqual(['Seeking Shot', 'Shadow Shot']);
        expect(Array.from(el.querySelectorAll('app-arcane-shot-picker .shot-known')).length).toBe(2);
        expect(el.querySelector('app-subclass-choices .subclass-spell-pick')).toBeNull();   // the cantrip was picked at 3
        expect(confirmButton().disabled).toBeTrue();

        const select = el.querySelector('app-arcane-shot-choice .shot-replace select') as HTMLSelectElement;
        expect(Array.from(select.options).map(o => o.textContent!.trim())).toEqual(['No change', 'Seeking Shot', 'Shadow Shot']);
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change'));
        refresh();
        expect(optionNames(el, '.shot-option.is-selected')).toEqual(['Shadow Shot']);

        click(el, 'app-arcane-shot-picker .shot-option', 'Bursting Shot');
        expect(confirmButton().disabled).toBeTrue();
        click(el, 'app-arcane-shot-picker .shot-option', 'Piercing Shot');
        expect(confirmButton().disabled).toBeFalse();
        // The list is full: every other box is disabled, so no fourth option can be ticked.
        const boxes = Array.from(el.querySelectorAll('app-arcane-shot-picker input')) as HTMLInputElement[];
        expect(boxes.filter(b => !b.checked).every(b => b.disabled)).toBeTrue();

        modal.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, {
          subclassChoices: { arcaneShots: ['Shadow Shot', 'Bursting Shot', 'Piercing Shot'] },
        });
      });
    });

    describe('Arcana Domain at Cleric 3', () => {
      const cantrips = [granted('Light', 0, 'Student of Arcana'), granted('Mage Hand', 0, 'Student of Arcana')];

      it('blocks Confirm until the skill and the two cantrips are chosen', () => {
        open({}, { subclassDue: true, subclassOptions: CLERIC });
        expect(component.canConfirm).toBeFalse();
        component.selectedSubclass = 'Life Domain';
        expect(component.canConfirm).toBeTrue();
        component.selectedSubclass = 'Arcana Domain';
        expect(component.subclassChoicesSatisfied).toBeFalse();
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { skills: ['Arcana'] }, valid: false }));
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ subclassChoices: { skills: ['Arcana'] }, newSpells: cantrips }));
        expect(component.canConfirm).toBeTrue();
      });

      it('sends the skill and the cantrips, each cantrip carrying Student of Arcana', () => {
        open({}, { subclassDue: true, subclassOptions: CLERIC });
        component.selectedSubclass = 'Arcana Domain';
        component.onSubclassChoices(result({ subclassChoices: { skills: ['Arcana'] }, newSpells: cantrips }));
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, {
          subclass: 'Arcana Domain', subclassChoices: { skills: ['Arcana'] }, newSpells: cantrips,
        });
      });

      it('sends them after the class picks and the always-prepared spells, never the same spell twice', () => {
        const bless = spell('Bless', 1, ['cleric']);
        const light = SPELLS[0];
        open({}, {
          subclassDue: true, subclassOptions: CLERIC, currentSpellsKnown: 5, newSpellsKnown: 6, newSpellSlots: { 1: 4, 2: 2 },
          alwaysPreparedSpellsBySubclass: { 'Arcana Domain': [{ name: 'Disintegrate', grantedBy: 'Arcana Domain Spells' }] },
        });
        component.spellList = [bless, light];
        component.selectedSubclass = 'Arcana Domain';
        component.selectedSpells = [bless, light];   // Light was picked for the class before the subclass picker took it
        // The child is told what the dialog has spoken for.
        expect(component.subclassChoiceExclusions).toEqual(['disintegrate', 'bless', 'light']);
        expect(component.subclassChoiceExclusions).toBe(component.subclassChoiceExclusions);

        component.onSubclassChoices(result({ subclassChoices: { skills: ['History'] }, newSpells: cantrips }));
        // A spell picked for the subclass is no longer offered as a class pick.
        expect(component.pickableSpells.map(s => s.name)).toEqual(['Bless']);
        component.confirm();
        const [, choices] = pcService.levelUp.calls.mostRecent().args;
        expect(choices!.newSpells!.map(s => [s.name, s.grantedBy ?? ''])).toEqual([
          ['Bless', ''], ['Disintegrate', 'Arcana Domain Spells'], ['Light', 'Student of Arcana'], ['Mage Hand', 'Student of Arcana'],
        ]);
        expect(choices!.subclassChoices).toEqual({ skills: ['History'] });
        expect(choices!.forgetSpells).toBeUndefined();
      });

      it('works through the rendered dialog and commits as the DM too', () => {
        open({ skills: { Insight: 'prof' }, spells: [] }, { subclassDue: true, subclassOptions: CLERIC });
        pcService.levelUpPreviewAsDm.and.returnValue(of(makePreview({ currentLevel: 2, newLevel: 3, subclassDue: true, subclassOptions: CLERIC })));
        pcService.levelUpAsDm.and.returnValue(of(makePC({ level: 3 })));
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          providers: [{ provide: PCService, useValue: pcService }, { provide: DndResourcesService, useValue: dndResources }],
        });
        const fixture = TestBed.createComponent(LevelUpModalComponent);
        fixture.componentInstance.pc = component.pc;
        fixture.componentInstance.asDm = true;
        const refresh = () => { fixture.detectChanges(); fixture.detectChanges(); };
        refresh();
        const el = fixture.nativeElement as HTMLElement;
        const click = (selector: string, text: string) => {
          const row = (Array.from(el.querySelectorAll(selector)) as HTMLElement[])
            .find(n => n.textContent!.replace(/\s+/g, ' ').trim().startsWith(text))!;
          (row.querySelector('input') as HTMLInputElement).click();
          refresh();
        };
        const confirmButton = () => el.querySelector('.modal-actions .btn.primary') as HTMLButtonElement;

        click('.subclass-option', 'Arcana Domain');
        expect(dndResources.getSpells).toHaveBeenCalled();
        const skills = Array.from(el.querySelectorAll('app-subclass-choices .skill-pick .subclass-option')).map(n => n.textContent!.trim());
        expect(skills).toEqual(['Arcana', 'History', 'Medicine', 'Persuasion', 'Religion']);
        expect(Array.from(el.querySelectorAll('app-subclass-choices .spell-name')).map(n => n.textContent!.trim()))
          .toEqual(['Light', 'Mage Hand', 'Fire Bolt']);
        expect(confirmButton().disabled).toBeTrue();
        click('app-subclass-choices .skill-pick .subclass-option', 'Religion');
        click('app-subclass-choices .spell-option', 'Mage Hand');
        expect(confirmButton().disabled).toBeTrue();
        click('app-subclass-choices .spell-option', 'Fire Bolt');
        expect(confirmButton().disabled).toBeFalse();

        confirmButton().click();
        const [id, choices] = pcService.levelUpAsDm.calls.mostRecent().args;
        expect(id).toBe(7);
        expect(choices!.subclass).toBe('Arcana Domain');
        expect(choices!.subclassChoices).toEqual({ skills: ['Religion'] });
        expect(choices!.newSpells!.map(s => [s.name, s.lvl, s.grantedBy, s.prepared])).toEqual([
          ['Mage Hand', 0, 'Student of Arcana', true], ['Fire Bolt', 0, 'Student of Arcana', true],
        ]);
        expect(choices!.forgetSpells).toBeUndefined();
      });
    });

    describe('Arcana Domain at later levels', () => {
      const held = [granted('Light', 0, 'Student of Arcana'), granted('Mage Hand', 0, 'Student of Arcana')];
      const settled = { subclass: 'Arcana Domain', subclassChoices: { skills: ['Arcana'] }, spells: held };

      it('asks nothing of a cleric whose choices are made, and sends nothing extra', () => {
        open({ ...settled, level: 3 });
        expect(component.effectiveSubclass).toBe('Arcana Domain');
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
      });

      it('replaces one cantrip: the forgotten name and its replacement go together', () => {
        open({ ...settled, level: 3 });
        component.onSubclassChoices(result({ forgetSpells: ['Light'], valid: false }));
        expect(component.canConfirm).toBeFalse();   // no replacement yet
        const fireBolt = granted('Fire Bolt', 0, 'Student of Arcana');
        component.onSubclassChoices(result({ forgetSpells: ['Light'], newSpells: [fireBolt] }));
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, { newSpells: [fireBolt], forgetSpells: ['Light'] });
      });

      it('goes back to an ordinary level-up when the swap is dropped', () => {
        open({ ...settled, level: 3 });
        component.onSubclassChoices(result({ forgetSpells: ['Light'], valid: false }));
        component.onSubclassChoices(result());
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, {});
      });

      it('blocks Confirm at Cleric 17 until the four Magical Mastery spells are picked, then sends them', () => {
        open({ ...settled, level: 16 });
        expect(component.subclassChoicesSatisfied).toBeFalse();
        expect(component.canConfirm).toBeFalse();
        const mastery = [granted('Disintegrate', 6, 'Magical Mastery'), granted('Teleport', 7, 'Magical Mastery'),
          granted('Maze', 8, 'Magical Mastery'), granted('Wish', 9, 'Magical Mastery')];
        component.onSubclassChoices(result({ newSpells: mastery.slice(0, 3), valid: false }));
        expect(component.canConfirm).toBeFalse();
        component.onSubclassChoices(result({ newSpells: mastery }));
        expect(component.canConfirm).toBeTrue();
        component.confirm();
        const [, choices] = pcService.levelUp.calls.mostRecent().args;
        expect(choices).toEqual({ newSpells: mastery });
        expect(choices!.newSpells!.every(s => s.alwaysPrepared && s.grantedBy === 'Magical Mastery')).toBeTrue();
      });

      it('replaces a Magical Mastery spell and a cantrip in the same level-up', () => {
        const mastery = [granted('Disintegrate', 6, 'Magical Mastery'), granted('Teleport', 7, 'Magical Mastery'),
          granted('Maze', 8, 'Magical Mastery'), granted('Wish', 9, 'Magical Mastery')];
        open({ ...settled, level: 17, spells: [...held, ...mastery] });
        expect(component.canConfirm).toBeTrue();
        const picks = [granted('Fire Bolt', 0, 'Student of Arcana'), granted('Mind Blank', 8, 'Magical Mastery')];
        component.onSubclassChoices(result({ forgetSpells: ['Light', 'Maze'], newSpells: picks }));
        component.confirm();
        expect(pcService.levelUp).toHaveBeenCalledWith(7, { newSpells: picks, forgetSpells: ['Light', 'Maze'] });
      });

      it('renders the swap select and the four pickers through the child', () => {
        open({ ...settled, level: 16 });
        const { el } = renderModal();
        expect(Array.from(el.querySelectorAll('app-subclass-choices .replace-pick .subclass-label')).map(n => n.textContent!.trim()))
          .toEqual(['Replace a Student of Arcana cantrip (optional)']);
        const labels = Array.from(el.querySelectorAll('app-subclass-choices .subclass-spell-pick .spell-label'))
          .map(n => n.textContent!.replace(/\s+/g, ' ').trim());
        expect(labels.length).toBe(4);
        expect(labels[0]).toContain('Magical Mastery, level 6 spell');
        expect(labels[3]).toContain('Magical Mastery, level 9 spell');
        expect((el.querySelector('.modal-actions .btn.primary') as HTMLButtonElement).disabled).toBeTrue();
      });
    });
  });
});
