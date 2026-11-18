import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';

import { LevelUpModalComponent } from './level-up-modal.component';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { PC } from '../../models/pc';
import { LevelUpPreview } from '../../models/level-up';

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
      ['getFeatDescription', 'getSpellsForClass']);
    dndResources.getFeatDescription.and.returnValue('A mighty feat.');
    dndResources.getSpellsForClass.and.returnValue(of([]));
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
});
