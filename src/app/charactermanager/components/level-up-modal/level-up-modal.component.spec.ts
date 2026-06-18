import { of, throwError } from 'rxjs';

import { LevelUpModalComponent } from './level-up-modal.component';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { PC } from '../../models/pc';
import { LevelUpPreview } from '../../models/level-up';

/** A SpyObj PCService — the modal only touches levelUpPreview / levelUp. */
function makePcServiceSpy(): jasmine.SpyObj<PCService> {
  return jasmine.createSpyObj<PCService>('PCService', ['levelUpPreview', 'levelUp']);
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
    ...overrides,
  };
}

describe('LevelUpModalComponent', () => {
  let component: LevelUpModalComponent;
  let pcService: jasmine.SpyObj<PCService>;
  let dndResources: jasmine.SpyObj<DndResourcesService>;

  beforeEach(() => {
    pcService = makePcServiceSpy();
    dndResources = jasmine.createSpyObj<DndResourcesService>('DndResourcesService', ['getFeatDescription']);
    dndResources.getFeatDescription.and.returnValue('A mighty feat.');
    component = new LevelUpModalComponent(pcService, dndResources);
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
});
